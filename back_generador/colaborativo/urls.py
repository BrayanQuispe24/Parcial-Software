from django.urls import path
from . import views

urlpatterns = [
    path("listar/", views.listar_rooms, name="listar-rooms"),
    path("create/", views.crear_room, name="crear-room"),
    path("<uuid:pk>/", views.detalle_room, name="detalle-room"),
    path("<uuid:pk>/update/", views.actualizar_room, name="actualizar-room"),
    path("<uuid:pk>/delete/", views.eliminar_room, name="eliminar-room"),
]
