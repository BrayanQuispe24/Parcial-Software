#!/bin/sh
set -e

# Espera a Postgres (simple)
python - <<'PY'
import os, time, sys
import psycopg
host = os.environ.get("DB_HOST","db")
port = int(os.environ.get("DB_PORT","5432"))
user = os.environ.get("DB_USER","colaborativouser")
password = os.environ.get("DB_PASSWORD","colaborativopass")
dbname = os.environ.get("DB_NAME","colaborativodb")
for i in range(60):
    try:
        with psycopg.connect(host=host, port=port, user=user, password=password, dbname=dbname) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
        print("PostgreSQL listo.")
        break
    except Exception as e:
        print("Esperando PostgreSQL...", e)
        time.sleep(1)
else:
    sys.exit("PostgreSQL no respondió a tiempo")
PY

# Migraciones automáticas (útil en dev)
python manage.py makemigrations colaborativo || true
python manage.py migrate --noinput || true

# Arranca Daphne (WebSocket + HTTP)
exec daphne \
  -b 0.0.0.0 -p 8001 \
  --ping-interval 20 \
  --ping-timeout 30 \
  --proxy-headers \
  diagramador.asgi:application
