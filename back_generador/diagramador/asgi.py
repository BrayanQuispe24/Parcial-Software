# chat/asgi.py
# fmt: off

import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# ✅ Configurar entorno Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "diagramador.settings")

# ✅ Inicializar Django (esto es obligatorio antes de importar apps o modelos)
django.setup()

# ✅ Importar rutas DESPUÉS de setup()
from colaborativo.routing import websocket_urlpatterns
from colaborativo.jwt_middleware import QueryStringJWTAuthMiddlewareStack

# fmt: on

# ✅ Configuración ASGI
application = ProtocolTypeRouter({
    # "http": get_asgi_application(), para habilitar http
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
