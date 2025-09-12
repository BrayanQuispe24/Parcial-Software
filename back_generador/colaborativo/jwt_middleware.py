# chat_app/jwt_middleware.py
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication

@database_sync_to_async
def _get_user_from_token(token: str):
    try:
        jwt_auth = JWTAuthentication()
        validated = jwt_auth.get_validated_token(token)
        return jwt_auth.get_user(validated)
    except Exception:
        return AnonymousUser()

class QueryStringJWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    def __call__(self, scope):
        return QueryStringJWTAuthInstance(scope, self.inner)

class QueryStringJWTAuthInstance:
    def __init__(self, scope, inner):
        self.scope = scope
        self.inner = inner

    async def __call__(self, receive, send):
        qs = parse_qs(self.scope.get("query_string", b"").decode())
        token = (qs.get("token") or [None])[0]
        self.scope["user"] = await _get_user_from_token(token) if token else AnonymousUser()
        inner = self.inner(self.scope)
        return await inner(receive, send)

def QueryStringJWTAuthMiddlewareStack(inner):
    # (Opcional) aquí podrías envolver con AuthMiddlewareStack si quieres soporte cookie+sesión además de JWT
    return QueryStringJWTAuthMiddleware(inner)
