import requests, json, re, random
from django.conf import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# 🔹 Prompt
FIXTURE_PROMPT = """
Eres un generador de datos ficticios en base a un diagrama UML en JSON.

El usuario te dará un objeto con dos secciones:
- "classes": cada clase con "name" y "attributes".
- "relationships": cada relación entre clases, con "sourceName", "targetName", "type" y "cardinality".

Debes responder SOLO con un JSON válido de la forma:

{
  "fixtures": {
    "NombreClase1": [ {...}, {...} ],
    "NombreClase2": [ {...}, {...} ]
  }
}

⚠️ Reglas importantes:
- Genera {count} registros por cada clase.
- Usa exactamente los atributos listados en "attributes".
- Agrega FKs según relaciones:
  - **Generalization (JOINED)**:
    - La superclase guarda los atributos comunes.
    - La subclase usa el MISMO id como PK y FK a la superclase.
    - La subclase NO repite atributos de la superclase.
  - **Association (0..1 → 1..*)**:
    - El lado "1..*" DEBE incluir un campo `sourceName_id` o `targetName_id`.
    - El lado "0..1" nunca lleva FK.
  - **Aggregation**:
    - El lado "parte" DEBE incluir un campo `targetName_id`, el valor puede ser NULL.
  - **Composition**:
    - El lado "parte" DEBE incluir un campo `targetName_id` y su valor NUNCA puede ser NULL.
- 🚫 Nunca pongas FKs en la superclase si no corresponde (ej: Persona NO debe tener pato_id, gato_id, galolo_id).
- Respeta la consistencia referencial: los IDs en FKs deben existir.
- Los datos deben ser ficticios pero realistas.
- No inventes atributos extra.
- No devuelvas texto adicional, solo JSON con "fixtures".
"""

# 🔹 Extrae JSON válido de la respuesta de Gemini
def extract_json(text: str) -> str:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return match.group(0) if match else "{}"

# 🔹 Llama a Gemini
def generate_test_data_with_gemini(diagram: dict, count: int = 5) -> dict:
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        return {"error": "Falta la API Key de Gemini"}

    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}

    data = {
        "contents": [
            {
                "parts": [
                    {"text": FIXTURE_PROMPT},
                    {"text": f"Genera {count} registros de prueba por clase."},
                    {"text": f"Diagrama actual:\n{json.dumps(diagram, indent=2)}"},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "response_mime_type": "application/json",
        },
    }

    try:
        resp = requests.post(
            GEMINI_API_URL, headers=headers, params=params, json=data, timeout=(10, 60)
        )
        resp.raise_for_status()
        result = resp.json()
        raw = result["candidates"][0]["content"]["parts"][0]["text"]
        clean = extract_json(raw)
        return json.loads(clean)
    except Exception as e:
        return {"error": str(e)}

# 🔹 Normaliza los IDs por tabla
def normalize_ids(fixtures: dict) -> dict:
    """
    Reindexa los IDs de cada tabla desde 1..N consecutivo.
    """
    for table, rows in fixtures.get("fixtures", {}).items():
        for idx, row in enumerate(rows, start=1):
            if "id" in row:
                row["id"] = idx
    return fixtures

# 🔹 Analiza relaciones UML
def analyze_relationships(diagram: dict):
    inheritance = {}
    aggregation = []
    composition = []
    associations = []

    for rel in diagram.get("relationships", []):
        src = rel["sourceName"].lower()
        tgt = rel["targetName"].lower()
        rel_type = rel["type"].lower()

        if rel_type == "generalization":
            inheritance[src.capitalize()] = tgt.capitalize()

        elif rel_type == "aggregation":
            aggregation.append(f"{src}.{tgt}_id")

        elif rel_type == "composition":
            composition.append(f"{src}.{tgt}_id")

        elif rel_type == "association":
            card = rel.get("cardinality", {})
            if card.get("target") == "1..*":
                associations.append(f"{tgt}.{src}_id")
            elif card.get("source") == "1..*":
                associations.append(f"{src}.{tgt}_id")

    return inheritance, aggregation, composition, associations

# 🔹 Convierte fixtures a SQL
def fixtures_to_sql(
    fixtures: dict,
    inheritance: dict = None,
    aggregation: list[str] = None,
    composition: list[str] = None,
    associations: list[str] = None,
) -> list[str]:
    """
    Convierte fixtures en sentencias SQL respetando UML.
    Si faltan FKs en los fixtures, los completa automáticamente.
    """
    sql_statements = []
    inheritance = inheritance or {}
    aggregation = aggregation or []
    composition = composition or []
    associations = associations or []

    # Índice rápido de IDs por tabla
    table_ids = {
        table.lower(): [row["id"] for row in rows if "id" in row]
        for table, rows in fixtures.get("fixtures", {}).items()
    }

    for table, rows in fixtures.get("fixtures", {}).items():
        table_l = table.lower()
        for row in rows:
            # Herencia (JOINED)
            if table in inheritance:
                parent = inheritance[table]
                parent_cols = [k for k in row.keys() if not k.endswith("_id")]
                parent_vals = [
                    "NULL" if row[c] is None else f"'{row[c]}'" if isinstance(row[c], str) else str(row[c])
                    for c in parent_cols
                ]
                sql_statements.append(
                    f"INSERT INTO {parent.lower()} ({', '.join(parent_cols)}) VALUES ({', '.join(parent_vals)});"
                )
                sql_statements.append(f"INSERT INTO {table_l} (id) VALUES ({row['id']});")
                continue

            # Caso normal
            cols, vals = [], []
            for k, v in row.items():
                fk_path = f"{table_l}.{k}"

                # Autocompletar FKs si faltan
                if fk_path in (aggregation + composition + associations) and v is None:
                    target_table = k.replace("_id", "")
                    if target_table in table_ids and table_ids[target_table]:
                        v = random.choice(table_ids[target_table])
                    elif fk_path in aggregation:
                        v = None
                    else:
                        raise ValueError(f"Falta valor para FK obligatoria: {fk_path}")

                cols.append(k)
                vals.append("NULL" if v is None else f"'{v}'" if isinstance(v, str) else str(v))

            sql_statements.append(
                f"INSERT INTO {table_l} ({', '.join(cols)}) VALUES ({', '.join(vals)});"
            )

    return sql_statements


