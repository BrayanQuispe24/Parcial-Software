import requests, json, re
from django.conf import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

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
- Además, LEE SIEMPRE las relaciones desde la sección "relationships" y AGREGA las claves foráneas necesarias:
  - Si la relación es de tipo "association" con cardinalidad { "source": "0..1", "target": "1..*" }
    → entonces el lado *source* debe tener un campo `targetName_id` como FK hacia el lado *target*.
  - Si ambos lados son "0..1"
    → uno de los lados (normalmente el source) debe tener un campo `targetName_id` que puede ser NULL.
  - Si un lado es "1"
    → el FK es obligatorio (no null).
- Si ya existe una clase intermedia explícita en "classes" (ej: `Perro_Persona`), genera registros en esa clase con IDs válidos de las tablas relacionadas.
- Respeta la consistencia referencial: los IDs usados en FKs deben existir en los fixtures de la tabla referenciada.
- Los datos deben ser ficticios pero realistas (nombres, direcciones, razas, etc.).
- No inventes atributos adicionales salvo los FKs requeridos por las relaciones.
- No devuelvas texto adicional, solo el JSON con "fixtures".
"""


def extract_json(text: str) -> str:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return match.group(0) if match else "{}"


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


def fixtures_to_sql(fixtures: dict) -> list[str]:
    sql_statements = []
    deferred = []   # relaciones many-to-many (tablas intermedias)
    fk_tables = []  # tablas con FKs detectadas

    for table, rows in fixtures.get("fixtures", {}).items():
        for row in rows:
            cols = ", ".join(row.keys())
            values = []
            for v in row.values():
                if isinstance(v, str):
                    values.append(f"'{v}'")
                elif v is None:
                    values.append("NULL")
                else:
                    values.append(str(v))
            sql = f"INSERT INTO {table.lower()} ({cols}) VALUES ({', '.join(values)});"

            # Heurística:
            # - si el nombre contiene "_": probablemente es intermedia (many-to-many)
            # - si alguna columna termina en "_id": contiene FK → va en fk_tables
            if "_" in table:
                deferred.append(sql)
            elif any(col.endswith("_id") for col in row.keys()):
                fk_tables.append(sql)
            else:
                sql_statements.append(sql)

    # El orden final será:
    # 1. Tablas sin FK
    # 2. Tablas con FK
    # 3. Tablas intermedias
    return sql_statements + fk_tables + deferred

