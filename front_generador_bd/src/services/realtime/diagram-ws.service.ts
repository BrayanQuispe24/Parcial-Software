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

  // Eventos salientes para que DiagramService los consuma
  snapshot$ = new Subject<{ version: number; snapshot: Snapshot }>();
  op$ = new Subject<{ version: number; op: DiagramOp; userId: number | null }>();
  drag$ = new Subject<{ id: string; pos: XY; userId: number | null }>();
  dragEnd$ = new Subject<{ id: string; pos: XY; userId: number | null }>();
  presence$ = new Subject<{ userId: number | null; state: 'join' | 'leave' }>();
  error$ = new Subject<any>();

  connect(wsBaseUrl: string, diagramId: string, token?: string) {
    const base = wsBaseUrl.replace(/\/+$/, '');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${base}/ws/diagram/${encodeURIComponent(diagramId)}/${qs}`;

    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.sendRaw({ cmd: 'init' });
    };
    this.ws.onclose = () => {
      this.error$.next({ type: 'close' });
    };
    this.ws.onerror = (e) => {
      this.error$.next({ type: 'error', e });
    };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // servidor envía: {evt: 'snapshot' | 'op' | 'drag' ...}
        switch (msg.evt) {
          case 'snapshot': {
            this.version = msg.version ?? 0;
            const snapshot: Snapshot = msg.snapshot ?? { nodes: {}, links: {} };
            this.snapshot$.next({ version: this.version, snapshot });
            // al recibir snapshot por conflicto, reintentamos la cola
            this.inFlight = false;
            this.kick();
            break;
          }
          case 'op': {
            const userId = msg.userId ?? null;
            const op: DiagramOp = msg.op;
            const ver: number = msg.version;

            // ¿Es el ack de mi in-flight?
            if (this.inFlight && this.queue.length && this.queue[0].cid && op.cid === this.queue[0].cid) {
              // ack de mi operación optimista → solo actualizo version y saco de cola
              this.version = ver;
              this.queue.shift();
              this.inFlight = false;
              this.kick();
            } else {
              // op remota → aplicarla
              this.version = ver;
              this.op$.next({ version: this.version, op, userId });
            }
            break;
          }
          case 'conflict': {
            // Me manda estado actual + snapshot; reseteo y reintento cola
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
        }
      } catch (e) {
        this.error$.next({ type: 'parse', e });
      }
    };
  }

  // —— API para el DiagramService ——
  sendDrag(id: string, pos: XY) {
    this.sendRaw({ cmd: 'drag', id, pos });
  }
  sendDragEnd(id: string, pos: XY) {
    this.sendRaw({ cmd: 'drag_end', id, pos });
  }

  enqueueOp(op: DiagramOp) {
    // marca correlación para acks
    if (!op.cid) op.cid = genCid();
    // optimista: el llamador ya debe haber aplicado la mutación localmente
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

  private sendRaw(payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }
}
