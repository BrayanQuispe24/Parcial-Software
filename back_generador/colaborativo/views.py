from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Diagram
from .serializer import RoomSerializer

def _add_ws_url(request, room_data):
    """
    Agrega el campo wsUrl dinámicamente a la respuesta.
    """
    ws_scheme = "wss" if request.is_secure() else "ws"
    host = request.get_host()
    room_data["wsUrl"] = f"{ws_scheme}://{host}/ws/diagram/{room_data['id']}/"
    return room_data


@api_view(["GET"])
def listar_rooms(request):
    rooms = Diagram.objects.all().order_by("-updated_at")
    serializer = RoomSerializer(rooms, many=True)
    data = [_add_ws_url(request, r) for r in serializer.data]
    return Response({"data": data})


@api_view(["POST"])
def crear_room(request):
    serializer = RoomSerializer(data=request.data)
    if serializer.is_valid():
        room = serializer.save()
        data = _add_ws_url(request, RoomSerializer(room).data)
        return Response(data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def detalle_room(request, pk):
    room = get_object_or_404(Diagram, pk=pk)
    data = _add_ws_url(request, RoomSerializer(room).data)
    return Response(data)


@api_view(["PUT", "PATCH"])
def actualizar_room(request, pk):
    """
    Actualiza una room existente (ej. cambiar el nombre).
    """
    room = get_object_or_404(Diagram, pk=pk)
    serializer = RoomSerializer(room, data=request.data, partial=(request.method == "PATCH"))
    if serializer.is_valid():
        room = serializer.save()
        data = _add_ws_url(request, RoomSerializer(room).data)
        return Response(data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
def eliminar_room(request, pk):
    room = get_object_or_404(Diagram, pk=pk)
    room.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
