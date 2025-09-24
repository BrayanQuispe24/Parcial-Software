from rest_framework import serializers
from .models import Diagram

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagram
        fields = ("id", "name", "version", "updated_at", "snapshot")
