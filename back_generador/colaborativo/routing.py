# chat_app/routing.py
from django.urls import re_path
#from colaborativo.consumers import ChatConsumer
from colaborativo.consumers import DiagramConsumer

websocket_urlpatterns = [
    #re_path(r"^ws/chat/(?P<room_name>[\w-]+)/$", ChatConsumer.as_asgi()),
    re_path(r"^ws/diagram/(?P<diagram_id>[\w-]+)/$", DiagramConsumer.as_asgi()),
]
