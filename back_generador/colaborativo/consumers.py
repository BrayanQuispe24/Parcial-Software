# chat_app/diagram_consumer.py
import json
import re
import uuid
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import transaction
from django.contrib.auth.models import AnonymousUser
from .models import Diagram, Operation
from asgiref.sync import sync_to_async
from gemini_api.services import process_diagram_with_gemini


def _safe_group_name(diagram_key: str) -> str:
    base = f"diagram.{diagram_key}"  # usa '.' en vez de ':'
    safe = re.sub(r"[^A-Za-z0-9._-]", "-", base)  # solo [A-Za-z0-9._-]
    return safe[:90]  # margen <100


class DiagramConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.diagram_key = self.scope["url_route"]["kwargs"]["diagram_id"]
        self.group = _safe_group_name(self.diagram_key)
        self.user = self.scope.get("user") or AnonymousUser()

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(
            self.group,
            {
                "type": "evt.presence",
                "userId": getattr(self.user, "id", None),
                "state": "join",
            },
        )

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)
        await self.channel_layer.group_send(
            self.group,
            {
                "type": "evt.presence",
                "userId": getattr(self.user, "id", None),
                "state": "leave",
            },
        )

    async def receive_json(self, msg):
        cmd = msg.get("cmd")

        if cmd == "init":
            snap = await self._get_or_create_snapshot()
            await self.send_json({"evt": "snapshot", **snap})

        elif cmd == "drag":
            await self.channel_layer.group_send(
                self.group,
                {
                    "type": "evt.drag",
                    "userId": getattr(self.user, "id", None),
                    "id": msg["id"],
                    "pos": {"x": int(msg["pos"]["x"]), "y": int(msg["pos"]["y"])},
                },
            )

        elif cmd == "drag_end":
            await self.channel_layer.group_send(
                self.group,
                {
                    "type": "evt.drag_end",
                    "userId": getattr(self.user, "id", None),
                    "id": msg["id"],
                    "pos": {"x": int(msg["pos"]["x"]), "y": int(msg["pos"]["y"])},
                },
            )

        elif cmd == "op":
            res = await self._apply_op(msg.get("baseVersion"), msg.get("op"))
            if res["status"] == "ok":
                await self.channel_layer.group_send(
                    self.group,
                    {
                        "type": "evt.op",
                        "version": res["version"],
                        "op": res["op"],
                        "userId": getattr(self.user, "id", None),
                    },
                )
            else:
                await self.send_json(
                    {
                        "evt": "conflict",
                        "currentVersion": res["currentVersion"],
                        "snapshot": res["snapshot"],
                    }
                )

        elif cmd == "ai_update":
            prompt = msg.get("prompt")
            if not prompt:
                await self.send_json({"evt": "error", "message": "Falta prompt"})
                return

            snap = await self._get_or_create_snapshot()

            # Llamar a Gemini sin bloquear el loop
            result = await sync_to_async(process_diagram_with_gemini)(
                prompt, snap["snapshot"]
            )

            if "error" in result:
                await self.send_json({"evt": "error", "message": result["error"]})
                return

            if "updates" in result:
                current_version = snap["version"]
                for op in result["updates"]:
                    res = await self._apply_op(current_version, op)
                    if res["status"] == "ok":
                        current_version = res["version"]  # 👈 actualizar versión
                        await self.channel_layer.group_send(
                            self.group,
                            {
                                "type": "evt.op",
                                "version": res["version"],
                                "op": res["op"],
                                "userId": getattr(self.user, "id", None),
                            },
                        )
                    else:
                        await self.send_json(
                            {
                                "evt": "conflict",
                                "currentVersion": res["currentVersion"],
                                "snapshot": res["snapshot"],
                            }
                        )
                        break  # sal del bucle si hay conflicto

    @staticmethod
    def _replace_snapshot(new_snapshot: dict):
        d = Diagram.objects.first()
        with transaction.atomic():
            d.snapshot = new_snapshot
            d.version += 1
            d.save(update_fields=["snapshot", "version", "updated_at"])

    # ---- Eventos del grupo -> socket
    async def evt_drag(self, event):
        await self.send_json(
            {"evt": "drag", **{k: v for k, v in event.items() if k != "type"}}
        )

    async def evt_drag_end(self, event):
        await self.send_json(
            {"evt": "drag_end", **{k: v for k, v in event.items() if k != "type"}}
        )

    async def evt_op(self, event):
        await self.send_json(
            {"evt": "op", **{k: v for k, v in event.items() if k != "type"}}
        )

    async def evt_presence(self, event):
        await self.send_json(
            {"evt": "presence", **{k: v for k, v in event.items() if k != "type"}}
        )

    async def evt_snapshot(self, event):
        await self.send_json({"evt": "snapshot", "snapshot": event["snapshot"]})

    # ---- Helpers DB
    @database_sync_to_async
    def _get_or_create_snapshot(self):
        d = _get_or_create_diagram_by_key(self.diagram_key)
        return {"diagramId": str(d.id), "version": d.version, "snapshot": d.snapshot}

    @database_sync_to_async
    def _apply_op(self, base_version, op: dict):
        with transaction.atomic():
            d = _get_or_create_diagram_by_key(self.diagram_key)
            d = Diagram.objects.select_for_update().get(pk=d.pk)

            if base_version != d.version:
                return {
                    "status": "conflict",
                    "currentVersion": d.version,
                    "snapshot": d.snapshot,
                }

            d.snapshot = apply_custom_op(d.snapshot, op)
            d.version += 1
            d.save(update_fields=["snapshot", "version", "updated_at"])

            Operation.objects.create(
                diagram=d,
                seq=d.version,
                user=getattr(self.user, "id", None),
                op_type=op.get("type", "custom"),
                payload=op,
            )
            return {"status": "ok", "version": d.version, "op": op}


# Helpers
def _get_or_create_diagram_by_key(key: str) -> Diagram:
    key_str = str(key)
    try:
        # ✅ Si es un UUID válido, buscamos directamente por PK
        uuid_obj = uuid.UUID(key_str)
        return Diagram.objects.get(pk=uuid_obj)
    except ValueError:
        # ❌ No es un UUID → no aceptamos como válido
        raise ValueError(f"Invalid diagram_id: {key_str}")
    except Diagram.DoesNotExist:
        # ❌ El UUID es válido pero no existe en BD
        raise ValueError(f"Diagram with id {key_str} does not exist")


def apply_custom_op(snapshot: dict, op: dict) -> dict:
    t = op.get("type")
    nodes = snapshot.setdefault("nodes", {})
    links = snapshot.setdefault("links", {})

    if t == "node.add":
        nid = op["id"]
        nodes[nid] = {"id": nid, **op.get("data", {})}
        return snapshot

    if t == "node.update":
        nid = op["id"]
        patch = op.get("patch", {})
        if nid in nodes:
            nodes[nid].update(patch)
        return snapshot

    if t == "node.remove":
        nid = op["id"]
        nodes.pop(nid, None)
        return snapshot

    if t == "link.add":
        lid = op["id"]
        links[lid] = {"id": lid, **op.get("data", {})}
        return snapshot

    if t == "link.remove":
        lid = op["id"]
        links.pop(lid, None)
        return snapshot

    if t == "relationship.add":
        lid = op["id"]
        links[lid] = {
            "id": lid,
            "sourceId": op["data"]["sourceId"],
            "targetId": op["data"]["targetId"],
            "type": op["data"]["type"],
            "cardinality": op["data"].get("cardinality", {}),
        }
        return snapshot

    if t == "relationship.remove":
        lid = op["id"]
        links.pop(lid, None)
        return snapshot

        return snapshot
