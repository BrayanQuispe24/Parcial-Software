import { Injectable } from '@angular/core';
import { UmlClass } from '../../models/uml-class.model';

@Injectable({
  providedIn: 'root'
})
export class MethodsClassesService {
  //aqui almacenaremos el grafo
  graph: any | null = null;
  joint: any | null = null;
  paper: any | null = null;

  constructor() { }


  buildRelationship(sourceId?: string, targetId?: string) {
     return new this.joint.dia.Link({
    name: 'Relacion',
    kind: 'association',       // 👈 NUEVO
    source: sourceId ? { id: sourceId } : undefined,
    target: targetId ? { id: targetId } : undefined,
    attrs: {
      '.connection': { stroke: '#333333', 'stroke-width': 2 },
      '.marker-target': { fill: '#333333', d: 'M 10 0 L 0 5 L 10 10 z' }
    },
      labels: [
        { position: { distance: 20, offset: -10 }, attrs: { text: { text: '0..1', fill: '#333' } } }, // origen
        { position: { distance: -20, offset: -10 }, attrs: { text: { text: '1..*', fill: '#333' } } } // destino
      ]
    });
  }


  createRelationship(sourceId: string, targetId: string, labelText: string = '1:n'): any {
    const link = this.buildRelationship(sourceId, targetId);
    this.graph.addCell(link);

    // Mostrar menú de cardinalidad inmediatamente
    setTimeout(() => {
      this.showCardinalityMenu(link, sourceId, targetId, this.paper.el);
    }, 0);

    return link;
  }

  private isValidCardinality(v: string): boolean {
    const t = v.trim();
    // Acepta: "1", "0", "*", "n", "N", "1..*", "0..1", "2..5", "*..*", etc.
    return /^(\d+|\*|n|N)$/.test(t) || /^(\d+|\*|n|N)\.\.(\d+|\*|n|N)$/.test(t);
  }


  private ensureTwoLabels(link: any) {
    const labels = link.labels?.() ?? [];
    if (labels.length < 1) {
      link.label(0, { position: { distance: 20, offset: -10 }, attrs: { text: { text: '' } } });
    }
    if (labels.length < 2) {
      link.label(1, { position: { distance: -20, offset: -10 }, attrs: { text: { text: '' } } });
    }
  }



  async showCardinalityMenu(link: any, sourceId: string, targetId: string, paperElement?: HTMLElement): Promise<void> {
    const hostEl: HTMLElement | null = paperElement ?? (this.paper && this.paper.el) ?? null;
    if (!hostEl) { console.warn('[showCardinalityMenu] Paper element no disponible'); return; }

    const menu = document.createElement('select');
    ['1..1', '1..*', '0..1', '0..*', 'n:n'].forEach(v => {
      const o = document.createElement('option'); o.value = o.textContent = v; menu.appendChild(o);
    });

    const paperRect = hostEl.getBoundingClientRect();
    const midpoint = link.get('vertices')?.[0] || link.getBBox().center();
    menu.style.position = 'absolute';
    menu.style.left = `${paperRect.left + midpoint.x}px`;
    menu.style.top = `${paperRect.top + midpoint.y}px`;
    menu.style.zIndex = '1000';
    document.body.appendChild(menu);

    // A veces el focus abre el dropdown; no es problema.
    setTimeout(() => menu.focus(), 0);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (menu.isConnected) menu.remove(); // evita NotFoundError
      document.removeEventListener('keydown', onKeyDown);
    };

    // this.graph?.trigger('local:link-changed', { link });

    const applyValue = () => {
      const value = menu.value;

      if (value === 'n:n') {
        link.remove();
        this.createJoinTableForManyToMany(sourceId, targetId);
        return; // 👈 no dispares 'local:link-changed' ni sigas //esto
      } else {
        // Asegura que existe el label 1
        const labels = link.labels?.() ?? [];
        if (labels.length < 2) {
          // si tu buildRelationship siempre pone 2 labels, esto no debería pasar,
          // pero lo reforzamos:
          link.label(0, labels[0] ?? { position: 20, attrs: { text: { text: '' } } });
          link.label(1, labels[1] ?? { position: -20, attrs: { text: { text: '' } } });
        }
        link.label(1, { attrs: { text: { text: value } } });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup();
    };

    // 1) Si cambia, aplicamos y limpiamos (una sola vez)
    menu.addEventListener('change', () => {
      const wasManyToMany = menu.value === 'n:n';
      applyValue();

      if (!wasManyToMany) {
        // para cambios normales de cardinalidad
        this.graph?.trigger('local:link-changed', { link });
      }
      cleanup();
    }, { once: true });



    // 2) Si se pierde foco sin cambiar, cerramos.
    //    Lo diferimos con setTimeout para dar oportunidad a que 'change' dispare primero.
    menu.addEventListener('blur', () => { setTimeout(() => cleanup(), 0); }, { once: true });

    document.addEventListener('keydown', onKeyDown);
  }


  /**************************************************************************************************
  *                   EDICIÓN DE CLASES Y RELACIONES
  ***************************************************************************************************/

  startEditing(model: any, field: 'name' | 'attributes' | 'methods', x: number, y: number) {
    // Mapa de selectores correctos en tu shape
    const SELECTOR_MAP: Record<typeof field, string> = {
      name: '.uml-class-name-text',
      attributes: '.uml-class-attrs-text',   // OJO: 'attrs'
      methods: '.uml-class-methods-text'
    };

    const selector = SELECTOR_MAP[field];

    // Valor actual desde attrs (no model.set/get directos)
    const currentValue = model.attr(`${selector}/text`) || '';

    // Colocación del editor sobre el Paper
    const paperRect = this.paper.el.getBoundingClientRect();
    const bbox = model.getBBox();
    const absX = paperRect.left + x;
    const absY = paperRect.top + y;

    // Input para name, Textarea para attributes/methods
    const editor = (field === 'name') ? document.createElement('input') : document.createElement('textarea');
    editor.value = currentValue;
    editor.style.position = 'absolute';
    editor.style.left = `${absX}px`;
    editor.style.top = `${absY}px`;
    editor.style.border = '1px solid #2196f3';
    editor.style.padding = '2px';
    editor.style.zIndex = '1000';
    editor.style.fontSize = '14px';
    editor.style.background = '#fff';
    // Ancho razonable según el elemento (márgenes ~20px)
    editor.style.minWidth = Math.max(120, bbox.width - 20) + 'px';

    if (field !== 'name') {
      (editor as HTMLTextAreaElement).rows = 4;
      editor.style.resize = 'none';
    }

    document.body.appendChild(editor);
    editor.focus();

    let closed = false;
    const finish = (save: boolean) => {
      if (closed) return;
      closed = true;

      if (save) {
        const raw = (editor as HTMLInputElement | HTMLTextAreaElement).value;
        const newValue = (field === 'name') ? raw.trim() : raw.replace(/\r?\n/g, '\n');

        // Actualiza el SVG
        model.attr(`${selector}/text`, newValue);

        // Actualiza el modelo (lo que viaja por WS)
        if (field === 'name') {
          model.set('name', newValue);
        } else if (field === 'attributes') {
          model.set('attributes', newValue);
        } else if (field === 'methods') {
          model.set('methods', newValue);
        }

        // Ajusta tamaño si tocaste attrs/methods
        if (field === 'attributes' || field === 'methods') {
          this.autoResizeUmlClass(model);
        }

        // Notifica edición local → DiagramService enviará node.update
        this.graph?.trigger('local:edit', { model });
      }

      // Limpia el editor
      if (editor.parentNode) editor.parentNode.removeChild(editor);
    };



    // Blur: guarda (como draw.io)
    editor.addEventListener('blur', () => finish(true));

    editor.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (field === 'name') {
        // Enter guarda, Escape cancela
        if (ke.key === 'Enter') { ke.preventDefault(); finish(true); }
        if (ke.key === 'Escape') { ke.preventDefault(); finish(false); }
      } else {
        // Atributos / Métodos (textarea):
        // Shift+Enter = salto de línea (default)
        // Enter = guardar
        if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); finish(true); }
        if (ke.key === 'Escape') { ke.preventDefault(); finish(false); }
      }
    });
  }




  /**
   * Crea una tabla intermedia para relación muchos a muchos
   */
  private createJoinTableForManyToMany(sourceId: string, targetId: string, opts: { silentLinks?: boolean } = { silentLinks: true }) {
    const sourceEl = this.graph.getCell(sourceId);
    const targetEl = this.graph.getCell(targetId);
    if (!sourceEl || !targetEl) return;

    const sourceName = sourceEl.attr('.uml-class-name-text/text') || 'ClaseA';
    const targetName = targetEl.attr('.uml-class-name-text/text') || 'ClaseB';
    const joinName = `${sourceName}_${targetName}`;

    // 🛑 Si ya existe, cancelar
    if (this.graph.getElements().some((el: any) => el.get('name') === joinName)) {
      console.warn('⚠️ Ya existe la tabla intermedia:', joinName);
      return;
    }

    // 🧠 Posicionar entre ambas clases
    const pos1 = sourceEl.position();
    const pos2 = targetEl.position();
    const joinX = (pos1.x + pos2.x) / 2 + 40;
    const joinY = (pos1.y + pos2.y) / 2 + 40;

    // ✅ Crear tabla intermedia UML
    const joinClass = this.createUmlClass({
      name: joinName,
      position: { x: joinX, y: joinY },
      attributes: [
        { name: `${sourceName.toLowerCase()}_id`, type: 'int' },
        { name: `${targetName.toLowerCase()}_id`, type: 'int' }
      ],
      methods: []
    });

    if (opts.silentLinks) {
      // Links 1:n sin menú
      const l1 = this.buildRelationship(sourceId, joinClass.id);
      this.ensureTwoLabels(l1);
      l1.label(0, { attrs: { text: { text: '0..1' } } });
      l1.label(1, { attrs: { text: { text: '1..*' } } });
      this.graph.addCell(l1);

      const l2 = this.buildRelationship(targetId, joinClass.id);
      this.ensureTwoLabels(l2);
      l2.label(0, { attrs: { text: { text: '0..1' } } });
      l2.label(1, { attrs: { text: { text: '1..*' } } });
      this.graph.addCell(l2);
    } else {
      // comportamiento anterior (si alguna vez lo quieres)
      this.createRelationship(sourceId, joinClass.id, '1:n');
      this.createRelationship(targetId, joinClass.id, '1:n');
    }

    return joinClass; // útil si luego quieres posicionar o usar el id
  }
  // === Ajusta alto de compartimentos y del elemento según el texto ===
  private autoResizeUmlClass = (model: any) => {
    if (!model || !model.isElement()) return;

    const NAME_H = 30;     // altura fija para nombre
    const LINE_H = 18;     // altura aproximada de línea de texto
    const PAD_V = 10;      // padding extra arriba/abajo
    const FIXED_W = 180;   // 👈 ancho fijo estándar

    // Leer textos actuales
    const attrsText = (model.attr('.uml-class-attrs-text/text') || '') as string;
    const methsText = (model.attr('.uml-class-methods-text/text') || '') as string;

    const attrsLines = Math.max(1, attrsText.split('\n').length);
    const methsLines = Math.max(1, methsText.split('\n').length);

    // Calcular alturas dinámicas
    const ATTRS_H = attrsLines * LINE_H + PAD_V;
    const METHS_H = methsLines * LINE_H + PAD_V;

    // Ajustar rectángulos
    model.attr('.uml-class-name-rect/height', NAME_H);
    model.attr('.uml-class-attrs-rect/height', ATTRS_H);
    model.attr('.uml-class-methods-rect/height', METHS_H);

    model.attr('.uml-class-attrs-rect/refY', NAME_H);
    model.attr('.uml-class-methods-rect/refY', NAME_H + ATTRS_H);

    // Calcular altura total
    const totalH = NAME_H + ATTRS_H + METHS_H;

    // 👇 Redimensionar con ancho fijo
    model.resize(FIXED_W, totalH);

    // Reajustar puertos al borde del nuevo tamaño
    this.updatePorts(model);
  };
  /**
   * Crea una clase UML con la estructura de tres compartimentos
   */
  createUmlClass(classModel: UmlClass): any {
    try {
      if (!this.joint || !this.graph) {
        throw new Error('JointJS no está inicializado');
      }

      // 👇 Forzar la creación del namespace custom
      this.createUmlNamespace();

      // Serializar atributos y métodos como texto para visualización
      const attributesText = classModel.attributes
        .map(attr => `${attr.name}: ${attr.type}`)
        .join('\n');

      const methodsText = classModel.methods
        .map(method => {
          const params = method.parameters ? `(${method.parameters})` : '()';
          const returnType = method.returnType ? `: ${method.returnType}` : '';
          return `${method.name}${params}${returnType}`;
        })
        .join('\n');

      // Crear clase UML personalizada con datos visibles + estructurados
      const umlClass = new this.joint.shapes.custom.UMLClass({
        position: classModel.position,
        size: classModel.size || { width: 180, height: 110 },
        name: classModel.name,
        attributes: attributesText,
        methods: methodsText,
        // 🔹 Añadimos los datos estructurados aquí
        customData: {
          attributes: classModel.attributes,
          methods: classModel.methods
        }
      });

      // Evento para actualizar tamaño si cambian atributos
      umlClass.on('change:attrs', () => {
        this.autoResizeUmlClass(umlClass);
      });

      // Añadir puertos (arriba, abajo, izq, der)
      umlClass.addPort({ group: 'inout', id: 'top' });
      umlClass.addPort({ group: 'inout', id: 'bottom' });
      umlClass.addPort({ group: 'inout', id: 'left' });
      umlClass.addPort({ group: 'inout', id: 'right' });

      // si vino id, respétalo (para colaborativo)
      const anyModel = classModel as any;
      if (anyModel.id) umlClass.set('id', anyModel.id);


      this.graph.addCell(umlClass);
      this.autoResizeUmlClass(umlClass);

      return umlClass;

    } catch (error) {
      console.error('Error al crear clase UML personalizada:', error);
      throw error;
    }
  }
  private createUmlNamespace(): void {
    if (!this.joint) return;
    if (this.joint.shapes.custom && this.joint.shapes.custom.UMLClass) {
      return;
    }

    this.joint.shapes.custom = this.joint.shapes.custom || {};

    this.joint.shapes.custom.UMLClass = this.joint.dia.Element.define('custom.UMLClass', {
      size: { width: 180, height: 110 },
      name: 'Entidad',
      attributes: '',
      methods: '',
      attrs: {
        rect: { strokeWidth: 2, stroke: '#2196f3', fill: '#ffffff' },

        '.uml-class-name-rect': {
          refWidth: '100%', height: 30, fill: '#e3f2fd', stroke: '#2196f3'
        },
        '.uml-class-attrs-rect': {
          refY: 30, refWidth: '100%', height: 40, fill: '#ffffff', stroke: '#2196f3'
        },
        '.uml-class-methods-rect': {
          refY: 70, refWidth: '100%', height: 40, fill: '#ffffff', stroke: '#2196f3'
        },

        '.uml-class-name-text': {
          ref: '.uml-class-name-rect',
          refY: .5, refX: .5,
          textAnchor: 'middle',
          yAlignment: 'middle',
          fontWeight: 'bold',
          fontSize: 14,
          fill: '#000000',
          text: 'Entidad'
        },
        '.uml-class-attrs-text': {
          ref: '.uml-class-attrs-rect',
          refY: 10, refX: 10,
          textAnchor: 'start',
          fontSize: 12,
          fill: '#000000',
          text: '',
          textWrap: { width: -20, height: 'auto' }, // ancho ≈ (width - 20px de márgenes)
          whiteSpace: 'pre-wrap'
        },
        '.uml-class-methods-text': {
          ref: '.uml-class-methods-rect',
          refY: 10, refX: 10,
          textAnchor: 'start',
          fontSize: 12,
          fill: '#000000',
          text: '',
          textWrap: { width: -20, height: 'auto' },
          whiteSpace: 'pre-wrap'
        }
      },
      ports: {
        groups: {
          inout: {
            position: { name: 'boundary' }, // 👈 siempre en borde
            attrs: {
              circle: {
                r: 5,
                magnet: true,
                stroke: '#2196f3',
                fill: '#fff',
                'stroke-width': 2,
                display: 'none'
              }
            }
          }
        }

      },

    }, {
      markup: [
        '<g class="rotatable">',
        '<g class="scalable">',
        '<rect class="uml-class-name-rect"/>',
        '<rect class="uml-class-attrs-rect"/>',
        '<rect class="uml-class-methods-rect"/>',
        '</g>',
        '<text class="uml-class-name-text"/>',
        '<text class="uml-class-attrs-text"/>',
        '<text class="uml-class-methods-text"/>',
        '<g class="ports"/>',  // 👈 contenedor de puertos
        '</g>'
      ].join(''),
    });

    // 🔹 Método updateRectangles para refrescar textos
    this.joint.shapes.custom.UMLClass.prototype.updateRectangles = function () {
      this.attr({
        '.uml-class-name-text': { text: this.get('name') || '' },
        '.uml-class-attrs-text': { text: this.get('attributes') || '' },
        '.uml-class-methods-text': { text: this.get('methods') || '' }
      });
    };

    this.joint.shapes.custom.UMLClass.prototype.initialize = function () {
      this.on('change:name change:attributes change:methods', this.updateRectangles, this);
      this.updateRectangles();
      this.constructor.__super__.initialize.apply(this, arguments);
    };

  }
  private updatePorts(model: any) {
    if (!model || !model.isElement()) return;

    const { width, height } = model.size();

    model.portProp('top', 'args', { x: width / 2, y: 0 });
    model.portProp('bottom', 'args', { x: width / 2, y: height });
    model.portProp('left', 'args', { x: 0, y: height / 2 });
    model.portProp('right', 'args', { x: width, y: height / 2 });
  }


}
