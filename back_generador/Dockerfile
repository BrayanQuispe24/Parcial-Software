# ===== Base (root) =====
FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libffi-dev curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ===== Dependencias =====
FROM base AS deps
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ===== Runtime =====
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
 && rm -rf /var/lib/apt/lists/*

# Usuario no root
RUN useradd -m appuser
WORKDIR /app

# Copiamos dependencias y proyecto
COPY --from=deps /usr/local /usr/local
COPY . .
# Bootstrap en Python (sin .sh)
COPY bootstrap.py /app/bootstrap.py

# Permisos
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
ENV ASGI_APP=diagramador.asgi:application

# Healthcheck: checa que el puerto 8000 esté aceptando conexiones TCP
HEALTHCHECK --interval=10s --timeout=2s --retries=5 \
  CMD python -c "import socket,sys; s=socket.socket(); s.settimeout(1); ok=0; \
try: s.connect(('127.0.0.1',8000)); ok=1 \
except Exception: pass \
finally: s.close(); sys.exit(0 if ok else 1)"

# Si NO usas bootstrap.py, deja el CMD de daphne; si SÍ lo usas, pon ENTRYPOINT:
# CMD ["sh","-c","daphne -b 0.0.0.0 -p 8000 ${ASGI_APP}"]
ENTRYPOINT ["python", "/app/bootstrap.py"]