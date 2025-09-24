# chat_app/models.py
import uuid
from django.conf import settings
from django.db import models

# --- EXISTENTE ---
class Message(models.Model):
    room = models.CharField(max_length=100, db_index=True)
    user = models.CharField(max_length=50, default="anon")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["room", "-created_at"])]
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.room}] {self.user}: {str(self.text)[:40]}"

# --- NUEVO: Estado colaborativo ---
class Diagram(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)   # 👈 sin default
    snapshot = models.JSONField(default=dict)
    version = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

class Operation(models.Model):
    diagram = models.ForeignKey(Diagram, on_delete=models.CASCADE, related_name="ops")
    seq = models.IntegerField()  # coincide con version tras aplicar
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    op_type = models.CharField(max_length=50)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["diagram", "seq"], name="uq_diagram_seq")
        ]
        indexes = [models.Index(fields=["diagram", "-seq"])]
