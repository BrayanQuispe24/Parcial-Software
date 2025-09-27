import requests, json
from django.conf import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# 👇 Aquí definimos el system_prompt dentro del archivo
SYSTEM_PROMPT = """
Eres un asistente para edición colaborativa de diagramas UML en JSON.

El usuario te dará un PROMPT y un DIAGRAMA (estado actual).
Debes responder SOLO con un objeto JSON de la forma:

{
  "updates": [
    { "type": "...", ... },
    { "type": "...", ... }
  ]
}

👉 Siempre usa un array en "updates", incluso si hay una sola operación.

Operaciones soportadas:
- node.add → agregar una clase
  { "type": "node.add", "id": "uuid-nuevo", "data": {...} }

- node.update → modificar atributos o métodos de una clase existente
  { "type": "node.update", "id": "uuid-existente", "patch": {...} }

- node.remove → eliminar una clase
  { "type": "node.remove", "id": "uuid-existente" }

- link.add → agregar una relación (association, aggregation, composition, generalization)
  { 
    "type": "link.add", 
    "id": "uuid-nuevo", 
    "data": {
      "sourceId": "uuid-source",
      "targetId": "uuid-target",
      "type": "association | aggregation | composition | generalization",
      "cardinality": { "source": "expresion", "target": "expresion" }
    }
  }

  Las cardinalidades permitidas son:
  - "1"
  - "0..1"
  - "*"
  - "1..*"
  - Rangos arbitrarios como "2..5", "3..*"

- link.remove → eliminar una relación
  { "type": "link.remove", "id": "uuid-existente" }

Reglas:
- Devuelve SIEMPRE un JSON válido con el campo "updates".
- Cada operación va dentro del array "updates".
- Mantén los IDs existentes cuando actualices o elimines.
- Usa nuevos UUIDs solo para nodos o links nuevos.
- NO devuelvas texto adicional.
- NO devuelvas el snapshot completo a menos que explícitamente el prompt diga "reset".
"""




def process_diagram_with_gemini(prompt: str, diagram: dict) -> dict:
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        return {"error": "Falta la API Key de Gemini"}

    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}

    data = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"text": f"Prompt del usuario:\n{prompt}"},
                    {"text": f"Diagrama actual:\n{json.dumps(diagram, indent=2)}"},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    }

    try:
        resp = requests.post(
            GEMINI_API_URL, headers=headers, params=params, json=data, timeout=(10, 30)
        )
        resp.raise_for_status()
        result = resp.json()
        raw = result["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e)}
