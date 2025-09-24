// +++ añade esto arriba +++
import { DiagramWsService, DiagramOp, LinkData } from './realtime/diagram-ws.service';
import { inject, Injectable } from '@angular/core';
import { MethodsClassesService } from './method-classes/methods-classes.service';


@Injectable({
  providedIn: 'root'
})
export class DiagramService {

  private ws?: DiagramWsService;              // +++
  private suppress = new Set<string>();       // evita eco de cambios remotos +++
  private joint: any;
  private graph: any;
  private paper: any;
  private selectedCell: any = null;

  private methodClassesService = inject(MethodsClassesService);

  /**
   * Inicializa JointJS y configura el papel y grafo
   */
  async initialize(paperElement: HTMLElement): Promise<void> {
    try {
      // Importamos JointJS
      this.joint = await import('jointjs');

      // Creamos el grafo
      this.graph = new this.joint.dia.Graph();
      this.methodClassesService.graph = this.graph;
      this.methodClassesService.joint = this.joint;
      // Creamos el papel/canvas
      this.paper = new this.joint.dia.Paper({
        el: paperElement,
        model: this.graph,
        width: 800,
        height: 1100,
        gridSize: 10,
        drawGrid: true,
        interactive: {
          elementMove: true,
          addLinkFromMagnet: true,
          //vertexAdd: false //quitar vertice para mover linea
        },
        background: { color: '#4c82b8ff' },
        defaultConnector: { name: 'rounded' },
        defaultLink: () => this.methodClassesService.buildRelationship(),

        validateConnection: (cellViewS: any, magnetS: any, cellViewT: any, magnetT: any) => {
          return (cellViewS !== cellViewT);
        }
      });
      this.methodClassesService.paper = this.paper;

      /**************************************************************************************************
      *                   EVENTOS INTERACTIVOS EN EL PAPER
      ***************************************************************************************************/

      //Seleccionar Una clase UML
      this.paper.on('cell:pointerclick', (cellView: any) => {
        if (this.selectedCell && this.selectedCell.isElement && this.selectedCell.isElement()) {
          // reset estilo + ocultar puertos
          this.selectedCell.attr('.uml-class-name-rect/stroke', '#2196f3');
          this.selectedCell.attr('.uml-class-attrs-rect/stroke', '#2196f3');
          this.selectedCell.attr('.uml-class-methods-rect/stroke', '#2196f3');
          this.selectedCell.attr('.uml-class-name-rect/stroke-width', 2);
          this.selectedCell.getPorts().forEach((p: any) => {
            this.selectedCell.portProp(p.id, 'attrs/circle/display', 'none');
          });
        }

        // Guardar nuevo seleccionado
        this.selectedCell = cellView.model;

        if (this.selectedCell.isElement && this.selectedCell.isElement()) {
          // highlight + mostrar puertos
          this.selectedCell.attr('.uml-class-name-rect/stroke', '#ff9800');
          this.selectedCell.attr('.uml-class-attrs-rect/stroke', '#ff9800');
          this.selectedCell.attr('.uml-class-methods-rect/stroke', '#ff9800');
          this.selectedCell.attr('.uml-class-name-rect/stroke-width', 3);

          this.selectedCell.getPorts().forEach((p: any) => {
            this.selectedCell.portProp(p.id, 'attrs/circle/display', 'block');
          });
        }
      });


      //👉 Deselect al hacer click en el fondo
      this.paper.on('blank:pointerclick', () => {
        this.clearSelection();
      });

      this.paper.on('cell:pointerdblclick', (cellView: any, evt: any, x: number, y: number) => {
        this.clearSelection();
        const model = cellView.model;
        const bbox = model.getBBox();
        const relativeY = y - bbox.y;

        const nameH = 30;
        const attrsH = parseFloat(model.attr('.uml-class-attrs-rect/height')) || 40;
        const methsH = parseFloat(model.attr('.uml-class-methods-rect/height')) || 40;

        const name = model.get('name');

        // ❌ Esto bloquea todo lo que no se llame 'Entidad'
        // if (name != 'Entidad') return;

        let field: 'name' | 'attributes' | 'methods' | null = null;

        if (relativeY < nameH) {
          field = 'name';
        } else if (relativeY < nameH + attrsH) {
          field = 'attributes';
        } else if (relativeY < nameH + attrsH + methsH) {
          field = 'methods';
        }

        if (field) this.methodClassesService.startEditing(model, field, x, y);
      });


      //👉 Doble clic en una relación para editar su etiqueta
      this.paper.on('link:pointerdblclick', (linkView: any, evt: MouseEvent, x: number, y: number) => {
        const model = linkView.model;
        const labelIndex = this.getClickedLabelIndex(linkView, evt);

        const name = model.get('name');
        if (name != "Relacion") return;
        if (labelIndex === null) return; // no fue sobre una etiqueta

        // 🔹 Abrir editor solo si fue sobre un label
        const label = model.label(labelIndex);
        const currentValue = label?.attrs?.text?.text || '';
        this.startEditingLabel(model, labelIndex, currentValue, x, y);

        // Opcional: resaltar visualmente el label en edición
        const labelNode = linkView.findLabelNode(labelIndex) as SVGElement;
        if (labelNode) {
          labelNode.setAttribute('stroke', '#2196f3');
          labelNode.setAttribute('stroke-width', '1');
        }
      }
      );
      //👉 Clic derecho en una relación para añadir una nueva etiqueta
      this.paper.on('link:contextmenu', (linkView: any, evt: MouseEvent, x: number, y: number) => {
        evt.preventDefault();

        // ¿El click derecho fue sobre una etiqueta?
        const labelIndex = this.getClickedLabelIndex(linkView, evt);
        if (labelIndex !== null) {
          // 👉 eliminar la etiqueta y notificar a los demás
          linkView.model.removeLabel(labelIndex);
          this.graph?.trigger('local:link-changed', { link: linkView.model });
          return;
        }


        // 👉 si no fue sobre una etiqueta, agregamos una nueva
        const model = linkView.model;
        const newLabel = {
          position: { distance: linkView.getClosestPoint(x, y).ratio, offset: -10 },
          attrs: { text: { text: 'label', fill: '#333', fontSize: 12 } }
        };
        model.appendLabel(newLabel);

        // Abrir editor inmediatamente
        const newIndex = model.labels().length - 1;
        this.startEditingLabel(model, newIndex, 'label', x, y);
      });
      console.log('JointJS inicializado correctamente');
      return Promise.resolve();
    } catch (error) {
      console.error('Error al inicializar JointJS:', error);
      return Promise.reject(error);
    }
  }

  private startEditingLabel(model: any, labelIndex: number, currentValue: string, x: number, y: number) {
    const paperRect = this.paper.el.getBoundingClientRect();
    const absX = paperRect.left + x;
    const absY = paperRect.top + y;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.style.position = 'absolute';
    input.style.left = `${absX}px`;
    input.style.top = `${absY}px`;
    input.style.border = '1px solid #2196f3';
    input.style.padding = '2px';
    input.style.zIndex = '1000';
    input.style.fontSize = '12px';
    input.style.background = '#fff';
    input.style.minWidth = '60px';

    document.body.appendChild(input);
    input.focus();

    let closed = false;
    const labelNode = (this.paper.findViewByModel(model) as any).findLabelNode(labelIndex) as SVGElement;
    if (labelNode) {
      labelNode.setAttribute('stroke', '#2196f3');
      labelNode.setAttribute('stroke-width', '1');
    }

    const finish = (save: boolean) => {
      if (closed) return;
      closed = true;

      if (save) {
        model.label(labelIndex, {
          ...model.label(labelIndex),
          attrs: { text: { text: input.value.trim() } }
        });
      }

      if (input.parentNode) input.parentNode.removeChild(input);
      // dentro de finish(save) de startEditingLabel, justo después de aplicar el texto:
      this.graph?.trigger('local:link-changed', { link: model });


      // quitar highlight
      if (labelNode) {
        labelNode.removeAttribute('stroke');
        labelNode.removeAttribute('stroke-width');
      }
    };

    // blur guarda
    input.addEventListener('blur', () => finish(true));

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        finish(e.key !== 'Escape'); // Enter/Espacio = guardar, Escape = cancelar
      }
    });
  }

  /**************************************************************************************************
  *                  FUNCIONES AUXILIARES
  ***************************************************************************************************/


  deleteSelected(): void {
    if (this.selectedCell) {
      this.selectedCell.remove();
      this.selectedCell = null;
    }
  }

  clearSelection(): void {
    if (this.selectedCell) {
      if (this.selectedCell.isElement && this.selectedCell.isElement()) {
        // 🔹 Restaurar estilo
        this.selectedCell.attr('.uml-class-name-rect/stroke', '#2196f3');
        this.selectedCell.attr('.uml-class-attrs-rect/stroke', '#2196f3');
        this.selectedCell.attr('.uml-class-methods-rect/stroke', '#2196f3');
        this.selectedCell.attr('.uml-class-name-rect/stroke-width', 2);

        // 🔹 Ocultar puertos (solo si es Element)
        this.selectedCell.getPorts().forEach((p: any) => {
          this.selectedCell.portProp(p.id, 'attrs/circle/display', 'none');
        });
      }

      // Reset selección para cualquier tipo (Element o Link)
      this.selectedCell = null;
    }
  }

  private getClickedLabelIndex(linkView: any, evt: MouseEvent): number | null {
    const labels = linkView.model.labels();
    if (!labels || labels.length === 0) return null;

    for (let i = 0; i < labels.length; i++) {
      const labelNode = linkView.findLabelNode(i);

      // Verificar si el target o alguno de sus ancestros pertenece al nodo del label
      if (labelNode && (evt.target === labelNode || labelNode.contains(evt.target as Node))) {
        return i;
      }
    }

    return null; // 👉 No fue sobre una etiqueta
  }



  /**************************************************************************************************
  *                  CONFIFURACIÓN Y CREACIÓN DE UML
  ***************************************************************************************************/




  /**
   * Configura los eventos interactivos para un elemento
   */
  setupClassInteraction(element: any): void {
    try {
      const elementView = this.paper.findViewByModel(element);

      if (elementView) {
        // elementView.on('element:pointerdblclick', () => {
        //   console.log('Doble clic en elemento - editar propiedades');
        //   // Aquí podríamos abrir un diálogo para editar propiedades
        // });
      }
    } catch (error) {
      console.error('Error al configurar interacción:', error);
    }
  }

  /**
   * Crea un namespace UML personalizado si no existe en JointJS
   */

  // +++ añade dentro de la clase +++
  attachWs(ws: DiagramWsService) {
    this.ws = ws;

    // ——— eventos remotos ———
    ws.snapshot$.subscribe(({ snapshot }) => this.applySnapshot(snapshot));
    ws.op$.subscribe(({ op }) => this.applyRemoteOp(op));
    ws.drag$.subscribe(({ id, pos }) => this.applyRemoteDrag(id, pos));
    ws.dragEnd$.subscribe(({ id, pos }) => this.applyRemoteDragEnd(id, pos));

    // ——— eventos locales → enviar ops ———

    // alta (elemento o link)
    this.graph.on('add', (cell: any) => {
      const id = cell.id as string;
      if (this.suppress.has(id) || !this.ws) return;

      if (cell.isElement && cell.isElement()) {
        const data = this.serializeNode(cell);
        this.ws.enqueueOp({ type: 'node.add', id, data });
      } else if (cell.isLink && cell.isLink()) {
        const data = this.serializeLink(cell);
        this.ws.enqueueOp({ type: 'link.add', id, data });
      }
    });

    // baja
    this.graph.on('remove', (cell: any) => {
      const id = cell.id as string;
      if (this.suppress.has(id) || !this.ws) return;

      const op: DiagramOp = (cell.isElement && cell.isElement())
        ? { type: 'node.remove', id }
        : { type: 'link.remove', id };

      this.ws.enqueueOp(op);
    });
    // Replica cambios de geometría (vértices) a todos
    this.graph.on('change:vertices', (link: any) => {
      if (!this.ws) return;
      const id = link.id as string;
      if (this.suppress.has(id)) return;
      this.queueLinkReplace(id, link);
    });
    //aqui
    // 🔹 Cambios en la conexión (cuando arrastras source o target)
    this.graph.on('change:source change:target', (link: any) => {
      if (!this.ws) return;
      const id = link.id as string;
      if (this.suppress.has(id)) return;
      this.queueLinkReplace(id, link);
    });
    // drag en vivo (broadcast efímero)
    this.paper.on('element:pointermove', (view: any) => {
      if (!this.ws) return;
      const m = view.model;
      this.ws.sendDrag(m.id, m.position());
    });

    // drag end (persistir posición)
    this.paper.on('element:pointerup', (view: any) => {
      if (!this.ws) return;
      const m = view.model;
      const pos = m.position();
      this.ws.sendDragEnd(m.id, pos);
      this.ws.enqueueOp({ type: 'node.update', id: m.id, patch: { position: pos } });
    });

    // edición de textos (desde MethodsClassesService, ver parche abajo)
    this.graph.on('local:edit', ({ model }: { model: any }) => {
      if (!this.ws) return;
      const id = model.id as string;
      if (this.suppress.has(id)) return;

      this.ws.enqueueOp({
        type: 'node.update',
        id,
        patch: {
          name: model.get('name'),
          attributes: model.get('attributes'),
          methods: model.get('methods')
        }
      });
    });

    // cambio de labels/cardinalidades (ver parches abajo)
    this.graph.on('local:link-changed', ({ link }: { link: any }) => {
      if (!this.ws) return;
      const id = link.id as string;
      if (this.suppress.has(id)) return;

      const data = this.serializeLink(link);
      // no hay 'link.update' en tu back → reemplazo remove+add
      this.ws.enqueueOp({ type: 'link.remove', id });
      this.ws.enqueueOp({ type: 'link.add', id, data });
    });
  }

  // +++ utilidades locales +++
  private serializeNode(cell: any) {
    const name = cell.get('name') || cell.attr('.uml-class-name-text/text') || '';
    const attributes = cell.get('attributes') ?? (cell.attr('.uml-class-attrs-text/text') || '');
    const methods = cell.get('methods') ?? (cell.attr('.uml-class-methods-text/text') || '');
    const position = cell.position();
    const size = cell.size();
    return { name, attributes, methods, position, size };
  }


  private serializeLink(link: any): LinkData {
    const src = link.get('source') || {};
    const tgt = link.get('target') || {};
    const labels = (link.labels?.() || []).map((l: any) => ({
      position: l?.position,
      attrs: { text: { text: l?.attrs?.text?.text || '' } }
    }));

    return {
      sourceId: src.id,
      targetId: tgt.id,
      sourcePort: src.port,
      targetPort: tgt.port,
      labels,
      vertices: link.get('vertices') || [],   // 👈 agrega esto
      kind: link.get('kind') || 'association'
    };
  }



  // private serializeLink(link: any): LinkData {
  //   const sourceId = link.get('source')?.id;
  //   const targetId = link.get('target')?.id;

  //   const labels = (link.labels?.() || []).map((l: any) => ({
  //     position: l?.position, // conserva distance/ratio/offset
  //     attrs: { text: { text: l?.attrs?.text?.text || '' } }
  //   }));

  //   const vertices = link.get('vertices') || [];

  //   return { sourceId, targetId, labels, vertices };
  // }


  // private serializeLink(link: any) {
  //   const sourceId = link.get('source')?.id;
  //   const targetId = link.get('target')?.id;
  //   const labels = (link.labels?.() || []).map((l: any) => l?.attrs?.text?.text || '');
  //   return { sourceId, targetId, labels };
  // }

  // +++ snapshot completo +++
  applySnapshot(snap: { nodes: Record<string, any>; links: Record<string, any> }) {
    this.suppress.clear();
    this.graph.clear();

    // nodos
    Object.entries(snap.nodes || {}).forEach(([id, data]) => this.addRemoteNode(id, data));
    // links
    Object.entries(snap.links || {}).forEach(([id, data]) => this.addRemoteLink(id, data));
  }

  // +++ una op remota +++
  applyRemoteOp(op: DiagramOp) {
    switch (op.type) {
      case 'node.add': this.addRemoteNode(op.id, op.data); break;
      case 'node.update': this.updateRemoteNode(op.id, op.patch); break;
      case 'node.remove': this.removeRemoteCell(op.id); break;
      case 'link.add': this.addRemoteLink(op.id, op.data); break;
      case 'link.remove': this.removeRemoteCell(op.id); break;
    }
  }

  // +++ drags remotos (efímeros) +++
  applyRemoteDrag(id: string, pos: { x: number; y: number }) {
    const cell = this.graph.getCell(id);
    if (cell?.isElement?.()) cell.position(pos.x, pos.y);
  }
  applyRemoteDragEnd(id: string, pos: { x: number; y: number }) {
    const cell = this.graph.getCell(id);
    if (cell?.isElement?.()) cell.position(pos.x, pos.y);
  }

  // +++ helpers de alta/actualización/baja remota +++
  private addRemoteNode(id: string, data: any) {
    this.suppress.add(id);

    // 🔹 Aceptar string o array para atributos
    const attrs = Array.isArray(data.attributes)
      ? data.attributes
      : (data.attributes || '')
        .split('\n')
        .filter(Boolean)
        .map((line: string) => {
          const [n, t] = line.split(':').map((s) => s?.trim() || '');
          return { name: n || '', type: t || '' };
        });

    // 🔹 Aceptar string o array para métodos
    const methods = Array.isArray(data.methods)
      ? data.methods
      : (data.methods || '')
        .split(/[\n,]+/)   // divide por salto de línea o coma
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((line: string) => {
          const m = line.match(/^([a-zA-Z_]\w*)\s*(\([^)]*\))?\s*(?::\s*(.+))?$/);
          return {
            name: (m?.[1] || line).trim(),
            parameters: (m?.[2] || '').replace(/[()]/g, ''),
            returnType: (m?.[3] || '').trim()
          };
        });



    const model = this.methodClassesService.createUmlClass({
      // respeta id para colaborativo
      // @ts-ignore
      id,
      name: data.name || 'Entidad',
      position: data.position || { x: 50, y: 50 },
      size: data.size || { width: 180, height: 110 },
      attributes: attrs,
      methods
    });

    setTimeout(() => this.suppress.delete(id), 0);
  }


  private updateRemoteNode(id: string, patch: any) {
    const el = this.graph.getCell(id);
    if (!el?.isElement?.()) return;
    this.suppress.add(id);

    if (patch.position) el.position(patch.position.x, patch.position.y);
    if (patch.size) el.resize(patch.size.width, patch.size.height);
    if (typeof patch.name === 'string') {
      el.set('name', patch.name);
      el.attr('.uml-class-name-text/text', patch.name);
    }

    // 🔹 Atributos: string o array
    if (patch.attributes) {
      let attrs: any[] = [];

      if (Array.isArray(patch.attributes)) {
        attrs = patch.attributes;
        el.set('attributes', attrs);
        el.attr('.uml-class-attrs-text/text',
          attrs.map(a => `${a.name}: ${a.type}`).join('\n')
        );
      } else if (typeof patch.attributes === 'string') {
        el.set('attributes', patch.attributes);
        el.attr('.uml-class-attrs-text/text', patch.attributes);
      }
    }

    // 🔹 Métodos: string o array
    if (patch.methods) {
      let methods: any[] = [];

      if (Array.isArray(patch.methods)) {
        methods = patch.methods;
        el.set('methods', methods);
        el.attr('.uml-class-methods-text/text',
          methods.map(m => `${m.name}(${m.parameters || ''})${m.returnType ? ': ' + m.returnType : ''}`).join('\n')
        );
      } else if (typeof patch.methods === 'string') {
        el.set('methods', patch.methods);
        el.attr('.uml-class-methods-text/text', patch.methods);
      }
    }

    setTimeout(() => this.suppress.delete(id), 0);
  }


  private attrsForKind(kind: 'association' | 'generalization' | 'aggregation' | 'composition' | 'dependency') {
    switch (kind) {
      case 'generalization':
        return {
          '.connection': { stroke: '#333', 'stroke-width': 2 },
          '.marker-target': { d: 'M 20 0 L 0 10 L 20 20 z', fill: '#fff', stroke: '#333' }
        };
      case 'aggregation':
        return {
          '.connection': { stroke: '#333', 'stroke-width': 2 },
          '.marker-source': { d: 'M 0 10 L 10 0 L 20 10 L 10 20 z', fill: '#fff', stroke: '#333' }
        };
      case 'composition':
        return {
          '.connection': { stroke: '#333', 'stroke-width': 2 },
          '.marker-source': { d: 'M 0 10 L 10 0 L 20 10 L 10 20 z', fill: '#333' }
        };
      case 'dependency':
        return {
          '.connection': { stroke: '#333', 'stroke-width': 2, 'stroke-dasharray': '4 2' },
          '.marker-target': { d: 'M 10 0 L 0 5 L 10 10 z', fill: '#333' }
        };
      default: // association
        return {
          '.connection': { stroke: '#333333', 'stroke-width': 2 },
          '.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' }
        };
    }
  }
  private addRemoteLink(id: string, data: any) {
    this.suppress.add(id);

    const kind: 'association' | 'generalization' | 'aggregation' | 'composition' | 'dependency' =
      (data.kind || data.type || 'association') as any;

    let labels: any[] = [];
    if (kind === 'association') {
      if (data.labels?.length) labels = data.labels;
      else if (data.cardinality) {
        labels = [
          { position: 0.1, attrs: { text: { text: data.cardinality.source || '' } } },
          { position: 0.9, attrs: { text: { text: data.cardinality.target || '' } } }
        ];
      }
    }

    const linkEl = new this.joint.dia.Link({
      id,
      source: { id: data.sourceId },
      target: { id: data.targetId },
      labels,
      vertices: data.vertices || [],   // 👈 usa los vértices recibidos
      attrs: this.attrsForKind(kind),
    });

    linkEl.set('kind', kind);
    this.graph.addCell(linkEl);

    setTimeout(() => this.suppress.delete(id), 0);
  }



  // private addRemoteLink(id: string, data: LinkData) {
  //   this.suppress.add(id);
  //   const kind = (data.kind as any) || 'association';
  //   const link = new this.joint.dia.Link({
  //     id,
  //     name: 'Relacion',
  //     kind,                               // 👈 guarda el tipo en el modelo
  //     source: { id: data.sourceId, port: data.sourcePort },
  //     target: { id: data.targetId, port: data.targetPort },
  //     attrs: this.attrsForKind(kind),     // 👈 aplica estilo correcto
  //     labels: data.labels || [],
  //     vertices: data.vertices || []
  //   });
  //   this.graph.addCell(link);
  //   setTimeout(() => this.suppress.delete(id), 0);
  // }


  // private addRemoteLink(id: string, data: LinkData) {
  //   this.suppress.add(id);
  //   const link = new this.joint.dia.Link({
  //     id,
  //     name: 'Relacion',
  //     source: { id: data.sourceId },
  //     target: { id: data.targetId },
  //     attrs: {
  //       '.connection': { stroke: '#333333', 'stroke-width': 2 },
  //       '.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' }
  //     },
  //     labels: data.labels || [],
  //     vertices: data.vertices || []
  //   });
  //   this.graph.addCell(link);
  //   setTimeout(() => this.suppress.delete(id), 0);
  // }

  // private addRemoteLink(id: string, data: any) {
  //   this.suppress.add(id);
  //   const link = new this.joint.dia.Link({
  //     id,
  //     name: 'Relacion',
  //     source: { id: data.sourceId },
  //     target: { id: data.targetId },
  //     attrs: {
  //       '.connection': { stroke: '#333333', 'stroke-width': 2 },
  //       '.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' }
  //     },
  //     labels: [
  //       { position: { distance: 20, offset: -10 }, attrs: { text: { text: data.labels?.[0] || '' } } },
  //       { position: { distance: -20, offset: -10 }, attrs: { text: { text: data.labels?.[1] || '' } } }
  //     ]
  //   });
  //   this.graph.addCell(link);
  //   setTimeout(() => this.suppress.delete(id), 0);
  // }

  private removeRemoteCell(id: string) {
    const cell = this.graph.getCell(id);
    if (!cell) return;
    this.suppress.add(id);
    cell.remove();
    setTimeout(() => this.suppress.delete(id), 0);
  }


  // --- añade estas propiedades privadas ---
  private pendingReplace = new Map<string, any>();
  private replaceTimer?: any;

  // --- añade este helper ---
  private queueLinkReplace(id: string, link: any) {
    this.pendingReplace.set(id, link);
    if (this.replaceTimer) return;
    this.replaceTimer = setTimeout(() => {
      const items = Array.from(this.pendingReplace.entries());
      this.pendingReplace.clear();
      this.replaceTimer = undefined;

      for (const [lid, lnk] of items) {
        const data = this.serializeLink(lnk);
        this.ws!.enqueueOp({ type: 'link.remove', id: lid });
        this.ws!.enqueueOp({ type: 'link.add', id: lid, data });
      }
    }, 80); // 80–120ms funciona bien
  }

  /**
 * Exporta todas las clases y relaciones UML del grafo como JSON estructurado
 * Incluye visibilidad basada en los prefijos "+" (public) y "-" (private)
 */
  exportFullDiagramAsJson(): string {
    const elements = this.graph.getElements();
    const links = this.graph.getLinks();

    const classMap: Record<string, string> = {};

    const classes = elements.map((cell: any) => {
      const id = cell.id;
      const name = cell.attr('.uml-class-name-text/text') || cell.get('name') || 'Unnamed';
      classMap[id] = name;

      const attrsText: string = cell.attr('.uml-class-attrs-text/text') || '';
      const methsText: string = cell.attr('.uml-class-methods-text/text') || '';

      const attributes = attrsText.split('\n').filter(line => line.trim() !== '').map(line => {
        // const visibility = line.trim().startsWith('+') ? 'public'
        //   : line.trim().startsWith('-') ? 'private'
        //     : 'unspecified';
        const cleanLine = line.replace(/^[-+]/, '').trim();
        const [name, type] = cleanLine.split(':').map(p => p.trim());
        return { name, type };
      });

      const methods = methsText.split('\n').filter(line => line.trim() !== '').map(line => {
        // const visibility = line.trim().startsWith('+') ? 'public'
        //   : line.trim().startsWith('-') ? 'private'
        //     : 'unspecified';
        const cleanLine = line.replace(/^[-+]/, '').trim();
        const nameMatch = cleanLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\(.*\))?\s*(:\s*.+)?$/);
        const name = nameMatch?.[1] || cleanLine;
        const parameters = nameMatch?.[2]?.replace(/[()]/g, '') || '';
        const returnType = nameMatch?.[3]?.replace(':', '').trim() || '';
        return { name, parameters, returnType };
      });

      return { id, name, attributes, methods };
    });

    const relationships = links.map((link: any) => {
      const source = link.get('source');
      const target = link.get('target');
      const kind = link.get('kind') || 'association';  // 👈 tipo real
      const labels = link.labels?.() || [];

      // Solo calculamos cardinalidades si es asociación
      let sourceCardinality = '';
      let targetCardinality = '';
      if (kind === 'association' && labels.length >= 2) {
        sourceCardinality = labels[0]?.attrs?.text?.text || '';
        targetCardinality = labels[1]?.attrs?.text?.text || '';
      }

      // Construimos el objeto y añadimos 'cardinality' solo para asociación
      const rel: any = {
        id: link.id,
        sourceId: source.id,
        targetId: target.id,
        sourceName: classMap[source.id] || '',
        targetName: classMap[target.id] || '',
        type: kind
      };

      if (kind === 'association' && (sourceCardinality || targetCardinality)) {
        rel.cardinality = {
          source: sourceCardinality,
          target: targetCardinality
        };
      }

      return rel;
    });


    return JSON.stringify({ classes, relationships }, null, 2);
  }


}
