import { inject, Injectable } from '@angular/core';
import { DiagramService } from './diagram.service';
import { MethodsClassesService } from './method-classes/methods-classes.service';

type RelationKind = 'association' | 'generalization' | 'aggregation' | 'composition' | 'dependency';

@Injectable({ providedIn: 'root' })
export class RelationshipService {
  private sourceElement: any = null;
  private paper: any = null;
  private clickHandler: any = null;
  private escHandler: any = null;              // ✨ para cancelar con ESC
  private prevInteractive: any = null;         // ✨ para restaurar interactividad
  private currentType: RelationKind = 'association';
  private methodsClassesService = inject(MethodsClassesService);

  // ✨ mapa de normalización
  private canonMap: Record<string, RelationKind> = {
    // asociación
    'association': 'association', 'asociacion': 'association', 'asociación': 'association',
    'relacion': 'association', 'relación': 'association',

    // herencia
    'generalization': 'generalization', 'herencia': 'generalization', 'inheritance': 'generalization',

    // agregación
    'aggregation': 'aggregation', 'agregacion': 'aggregation', 'agregación': 'aggregation',

    // composición
    'composition': 'composition', 'composicion': 'composition', 'composición': 'composition',

    // dependencia
    'dependency': 'dependency', 'dependencia': 'dependency'
  };

  private canon(t: string | undefined | null): RelationKind {
    const k = String(t ?? '').toLowerCase().trim();
    return this.canonMap[k] ?? 'association';
  }

  constructor(private diagramService: DiagramService) {}

  /**
   * Inicia el modo de creación de relación con un tipo específico
   */
  startLinkCreation(paper: any, containerElement: HTMLElement, type: string = 'association'): void {
    this.paper = paper;
    this.sourceElement = null;
    this.currentType = this.canon(type); // ✨ normaliza

    // Cursor de modo creación
    containerElement.style.cursor = 'crosshair';

    // ✨ Desactiva creación automática desde magnet (evita defaultLink = asociación)
    this.prevInteractive = this.paper.options.interactive;
    this.paper.options.interactive = { ...(this.prevInteractive || {}), addLinkFromMagnet: false };

    // Listener de selección
    this.clickHandler = (cellView: any) => {
      if (!this.sourceElement) {
        // Primera selección
        this.sourceElement = cellView.model;
        console.log(`Primer elemento seleccionado para relación (${this.currentType})`);
      } else {
        // Segunda selección → crear la relación tipada
        this.createTypedRelationship(this.sourceElement.id, cellView.model.id, this.currentType);

        // Limpieza
        this.paper.off('cell:pointerclick', this.clickHandler);
        containerElement.style.cursor = 'default';
        this.clickHandler = null;
        this.sourceElement = null;

        // ✨ Restaurar interactividad original
        if (this.prevInteractive) {
          this.paper.options.interactive = this.prevInteractive;
          this.prevInteractive = null;
        }

        // ✨ remover ESC handler si estaba
        if (this.escHandler) {
          document.removeEventListener('keydown', this.escHandler);
          this.escHandler = null;
        }

        console.log(`Relación creada (${this.currentType})`);
      }
    };

    this.paper.on('cell:pointerclick', this.clickHandler);

    // ✨ ESC para cancelar
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cancelLinkCreation(containerElement);
        document.removeEventListener('keydown', this.escHandler);
        this.escHandler = null;
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Crea una relación del tipo solicitado entre dos elementos
   */
  private createTypedRelationship(sourceId: string, targetId: string, type: RelationKind) {
    switch (type) {
      case 'association':
        this.methodsClassesService.createRelationship(sourceId, targetId, '1:n');
        break;

      case 'generalization': // Herencia (triángulo hueco en el target)
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            kind:'generalization',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': { stroke: '#333', 'stroke-width': 2 },
              '.marker-target': {
                d: 'M 20 0 L 0 10 L 20 20 z',
                fill: '#fff',
                stroke: '#333'
              }
            }
          })
        );
        break;

      case 'aggregation': // Rombo hueco en el source
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            kind:'aggregation',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': { stroke: '#333', 'stroke-width': 2 },
              '.marker-source': {
                d: 'M 0 10 L 10 0 L 20 10 L 10 20 z',
                fill: '#fff',
                stroke: '#333'
              }
            }
          })
        );
        break;

      case 'composition': // Rombo sólido en el source
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            kind:'composition',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': { stroke: '#333', 'stroke-width': 2 },
              '.marker-source': {
                d: 'M 0 10 L 10 0 L 20 10 L 10 20 z',
                fill: '#333'
              }
            }
          })
        );
        break;

      case 'dependency': // Línea punteada con flecha en target
        this.diagramService['graph'].addCell(
          new this.diagramService['joint'].dia.Link({
            name: 'Relacion',
            kind:'dependency',
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
              '.connection': {
                stroke: '#333',
                'stroke-width': 2,
                'stroke-dasharray': '4 2'
              },
              '.marker-target': {
                d: 'M 10 0 L 0 5 L 10 10 z',
                fill: '#333'
              }
            }
          })
        );
        break;

      default:
        console.warn(`Tipo de relación desconocido: ${type}, usando asociación.`);
        this.methodsClassesService.createRelationship(sourceId, targetId, '1:n');
    }
  }

  /**
   * Cancela el modo de creación de relación
   */
  cancelLinkCreation(containerElement: HTMLElement): void {
    if (this.paper && this.clickHandler) {
      this.paper.off('cell:pointerclick', this.clickHandler);
      this.clickHandler = null;
    }
    containerElement.style.cursor = 'default';
    this.sourceElement = null;
    this.currentType = 'association';

    // ✨ restaurar interactividad original
    if (this.prevInteractive) {
      this.paper.options.interactive = this.prevInteractive;
      this.prevInteractive = null;
    }

    // ✨ remover ESC handler si estaba
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
  }
}
