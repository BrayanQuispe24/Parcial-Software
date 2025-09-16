# chat/asgi.py
# fmt: off

import os
import django
from django.core.asgi import get_asgi_application  # ✅ IMPORTACIÓN NECESARIA
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "diagramador.settings")
django.setup()

from colaborativo.routing import websocket_urlpatterns
from colaborativo.jwt_middleware import QueryStringJWTAuthMiddlewareStack

# fmt: on

application = ProtocolTypeRouter({
    "http": get_asgi_application(),  # ✅ ACTIVO AHORA
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
