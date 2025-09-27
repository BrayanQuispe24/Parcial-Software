import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

type XY = { x: number; y: number };
type Size = { width: number; height: number };

export type LabelDTO = {
  position?: number | { distance?: number; offset?: number; ratio?: number };
  attrs?: { text?: { text?: string } };
};


export type NodeData = {
  name: string;
  position: XY;
  size: Size;
  attributes: string;   // texto multilinea (mismo que en .uml-class-attrs-text)
  methods: string;      // texto multilinea (mismo que en .uml-class-methods-text)
};
// arriba, junto a los tipos
type LinkKind = 'association' | 'generalization' | 'aggregation' | 'composition' | 'dependency';

export type LinkData = {
  sourceId: string;
  targetId: string;
  sourcePort?: string;
  targetPort?: string;
  labels?: LabelDTO[];
  vertices?: XY[];
  kind?: LinkKind;             // 👈 NUEVO
};




// export type LinkData = {
//   sourceId: string;
//   targetId: string;
//   labels?: LabelDTO[];  // ahora no es string[], guardamos pos + texto
//   vertices?: XY[];      // puntos intermedios de la línea
// };

export type DiagramOp =
  | { cid?: string; type: 'node.add'; id: string; data: NodeData }
  | { cid?: string; type: 'node.update'; id: string; patch: Partial<NodeData> }
  | { cid?: string; type: 'node.remove'; id: string }
  | { cid?: string; type: 'link.add'; id: string; data: LinkData }
  | { cid?: string; type: 'link.remove'; id: string };

type Snapshot = { nodes: Record<string, NodeData>; links: Record<string, LinkData> };

function genCid(): string {
  // suficiente para correlacionar acks
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

@Injectable({ providedIn: 'root' })
export class DiagramWsService {
  private ws?: WebSocket;

  private version = 0;
  private inFlight = false;
  private queue: DiagramOp[] = [];

  // Eventos de diagramas
  snapshot$ = new Subject<{ version: number; snapshot: Snapshot }>();
  op$ = new Subject<{ version: number; op: DiagramOp; userId: number | null }>();
  drag$ = new Subject<{ id: string; pos: XY; userId: number | null }>();
  dragEnd$ = new Subject<{ id: string; pos: XY; userId: number | null }>();
  presence$ = new Subject<{ userId: number | null; state: 'join' | 'leave' }>();

  // Eventos de rooms (chat)
  message$ = new Subject<{ userId: number | null; content: string }>();

  error$ = new Subject<any>();

  // ====== 🔌 Cerrar conexión ======
  disconnect(code: number = 1000, reason: string = "Client disconnect") {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("🔌 Cerrando WebSocket:", reason);
      this.ws.close(code, reason);
    }
    this.ws = undefined;
    this.inFlight = false;
    this.queue = [];
  }

  // ====== Conectar a un diagrama ======
  connect(urlOrBase: string, diagramId?: string, token?: string) {
    // 👉 primero cerramos si ya hay uno abierto
    console.log('Desconectando del antiguo diagrama');
    this.disconnect(1000, "Reconnecting");

    let url: string;
    if (diagramId) {
      const base = urlOrBase.replace(/\/+$/, '');
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      url = `${base}/wss/diagram/${encodeURIComponent(diagramId)}/` + qs;
    } else {
      url = urlOrBase;
    }

    try {
      console.log("🌐 Conectando a:", url);
      this.ws = new WebSocket(url);
      this.ws.onopen = () => this.sendRaw({ cmd: 'init' });
      this.setupListeners();
    } catch (error) {
      console.log('Error');
    }
  }

  // ====== Conectar a un room ======
  connectRoom(baseUrl: string, roomId: string, token?: string) {
    const base = baseUrl.replace(/\/+$/, '');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${base}/wss/room/${encodeURIComponent(roomId)}/` + qs;

    console.log("🌐 Conectar a room:", url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.sendRaw({ cmd: 'join', roomId });
    this.setupListeners();
  }

  // ====== Listeners compartidos ======
  private setupListeners() {
    if (!this.ws) return;

    this.ws.onclose = (e) => {
      console.warn("⚠️ WebSocket cerrado:", e);
      this.error$.next({ type: 'close' });
    };
    this.ws.onerror = (e) => {
      console.error("❌ Error en WebSocket:", e);
      this.error$.next({ type: 'error', e });
    };
    this.ws.onmessage = (ev) => this.handleMessage(ev.data);
  }

  // ====== Procesar mensajes ======
  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);

      switch (msg.evt) {
        // === Diagramas ===
        case 'snapshot': {
          this.version = msg.version ?? 0;
          const snapshot: Snapshot = msg.snapshot ?? { nodes: {}, links: {} };
          this.snapshot$.next({ version: this.version, snapshot });
          this.inFlight = false;
          this.kick();
          break;
        }
        case 'op': {
          const userId = msg.userId ?? null;
          const op: DiagramOp = msg.op;
          const ver: number = msg.version;

          if (this.inFlight && this.queue.length && this.queue[0].cid && op.cid === this.queue[0].cid) {
            this.version = ver;
            this.queue.shift();
            this.inFlight = false;
            this.kick();
          } else {
            this.version = ver;
            this.op$.next({ version: this.version, op, userId });
          }
          break;
        }
        case 'conflict': {
          this.version = msg.currentVersion ?? this.version;
          const snapshot: Snapshot = msg.snapshot ?? { nodes: {}, links: {} };
          this.snapshot$.next({ version: this.version, snapshot });
          this.inFlight = false;
          this.kick();
          break;
        }
        case 'drag': {
          this.drag$.next({ id: msg.id, pos: msg.pos, userId: msg.userId ?? null });
          break;
        }
        case 'drag_end': {
          this.dragEnd$.next({ id: msg.id, pos: msg.pos, userId: msg.userId ?? null });
          break;
        }
        case 'presence': {
          this.presence$.next({ userId: msg.userId ?? null, state: msg.state });
          break;
        }

        // === Rooms ===
        case 'message': {
          this.message$.next({ userId: msg.userId ?? null, content: msg.content });
          break;
        }
      }
    } catch (e) {
      console.error("❌ Error al parsear mensaje:", e);
      this.error$.next({ type: 'parse', e });
    }
  }

  // ====== API rooms ======
  // sendMessage(roomId: string, content: string) {
  //   this.sendRaw({ cmd: 'message', roomId, content });
  // }
  // ====== API Rooms (chat) ======
  //para mensajes
  sendMessage(content: string) {
    this.sendRaw({ cmd: 'message', content });
  }
  //para promps
  sendPrompt(prompt: string) {
    this.sendRaw({ cmd: 'ai_update', prompt });
  }
  // ====== API diagramas ======
  sendDrag(id: string, pos: XY) {
    this.sendRaw({ cmd: 'drag', id, pos });
  }
  sendDragEnd(id: string, pos: XY) {
    this.sendRaw({ cmd: 'drag_end', id, pos });
  }
  enqueueOp(op: DiagramOp) {
    if (!op.cid) op.cid = genCid();
    this.queue.push(op);
    this.kick();
  }

  private kick() {
    if (this.inFlight || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.queue.length) return;

    const next = this.queue[0];
    this.inFlight = true;
    this.sendRaw({ cmd: 'op', baseVersion: this.version, op: next });
  }

  // ====== Low-level ======
  private sendRaw(payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }
}

