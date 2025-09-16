# ===== Base moderna compatible con Django 5 / Channels 4 / Twisted 25 =====
FROM python:3.12-slim-bookworm

# Logs sin buffer y sin .pyc
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=America/La_Paz

WORKDIR /app

# Paquetes del sistema (compilación y libpq para psycopg si no usas el binario)
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Primero requirements para cachear capas
COPY requirements.txt ./requirements.txt

# pip actualizado e instalación de dependencias
# Nota: mantengo tus pines tal cual. Si algún wheel no existe para tu arch,
# podría requerir compilar; con estas libs debería alcanzar.
RUN python -m pip install --upgrade pip \
 && python -m pip install -r requirements.txt

# Usuario no-root
RUN useradd -m appuser
USER appuser

# Copiar el código
COPY --chown=appuser:appuser . .

# Puerto de la app ASGI (Daphne en requirements)
EXPOSE 8000

# Permite sobreescribir el módulo ASGI por variable de entorno
ENV ASGI_APP=${ASGI_APP:-diagramador.asgi:application}

# Comando por defecto: servir ASGI con Daphne
#CMD ["sh", "-c", "exec daphne -b 0.0.0.0 -p 8000 ${ASGI_APP}"]
