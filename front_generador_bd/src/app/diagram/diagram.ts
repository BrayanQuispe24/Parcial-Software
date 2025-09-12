import { AfterViewInit, Component, ElementRef, HostListener, inject, Inject, NgZone, PLATFORM_ID, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CdkDragEnd, CdkDropListGroup, CdkDropList } from '@angular/cdk/drag-drop';
import { SidePanel } from "../side-panel/side-panel";
import { DiagramService } from '../../services/diagram.service';
import { FallbackService } from '../../services/fallback.service';
import { RelationshipService } from '../../services/relationship.service';
import { UmlClass } from '../../models/uml-class.model';
import { MethodsClassesService } from '../../services/method-classes/methods-classes.service';
import { DiagramWsService } from '../../services/realtime/diagram-ws.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-diagram',
  standalone: true,
  templateUrl: './diagram.html',
  styleUrls: ['./diagram.css'],
  imports: [SidePanel, CdkDropListGroup, CdkDropList]
})
export class Diagram implements AfterViewInit {
  @ViewChild('paperContainer', { static: true }) paperContainer!: ElementRef<HTMLElement>;
  @ViewChild(SidePanel) sidePanel!: SidePanel;

  private methodClassesService = inject(MethodsClassesService);

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone,
    private diagramService: DiagramService,
    private fallbackService: FallbackService,
    private relationshipService: RelationshipService,
    private ws: DiagramWsService,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    this.ngZone.run(async () => {
      try {
        await this.diagramService.initialize(this.paperContainer.nativeElement);

        // 👉 Conecta WS
        const diagramId = 'mi-room'; // o toma desde la ruta
        const token = undefined;      // si usas cookies de sesión, déjalo undefined
        this.ws.connect(environment.wsBaseUrl, diagramId, token);

        // Pasa el WS al servicio
        this.diagramService.attachWs(this.ws);

        // Suscripciones a eventos remotos
        this.ws.snapshot$.subscribe(({ snapshot }) => this.diagramService.applySnapshot(snapshot));
        this.ws.op$.subscribe(({ op }) => this.diagramService.applyRemoteOp(op));
        this.ws.drag$.subscribe(({ id, pos }) => this.diagramService.applyRemoteDrag(id, pos));
        this.ws.dragEnd$.subscribe(({ id, pos }) => this.diagramService.applyRemoteDragEnd(id, pos));

        // Eventos del panel lateral
        this.sidePanel.elementDragged.subscribe((event: CdkDragEnd) => this.onDragEnded(event));
        this.sidePanel.exportRequested.subscribe(() => this.exportJSON());

        console.log('Diagrama inicializado + WS listo');
      } catch (error) {
        console.error('Error al inicializar el diagrama:', error);
      }
    });
  } // 👈 CIERRE de ngAfterViewInit (esto faltaba)

  @HostListener('document:keydown', ['$event'])
  handleEscape(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.diagramService.deleteSelected();
    } else if (event.key === 'Escape') {
      this.diagramService.clearSelection();
    }
  }

  onDragEnded(event: CdkDragEnd) {
    this.ngZone.run(() => {
      const type = (event.source.data as any)?.type;
      const { x, y } = event.dropPoint; // posición absoluta
      const rect = this.paperContainer.nativeElement.getBoundingClientRect();
      const pos = { x: x - rect.left, y: y - rect.top };

      console.log('Elemento arrastrado:', type, 'Posición:', pos);

      if (type === 'class') {
        try {
          const umlClassModel: UmlClass = {
            name: 'Entidad',
            position: pos,
            size: { width: 180, height: 110 },
            attributes: [
              { name: 'id', type: 'int' },
              { name: 'nombre', type: 'string' }
            ],
            methods: [
              { name: 'crear' },
              { name: 'eliminar' }
            ]
          };
          this.methodClassesService.createUmlClass(umlClassModel);
          console.log('Entidad UML creada correctamente');
        } catch (error) {
          console.error('Error al crear el elemento:', error);
          const fallbackClass: UmlClass = {
            name: 'Entidad',
            position: pos,
            attributes: [
              { name: 'id', type: 'int' },
              { name: 'nombre', type: 'string' }
            ],
            methods: [
              { name: 'crear' },
              { name: 'eliminar' }
            ]
          };
          this.fallbackService.createFallbackElement(this.paperContainer.nativeElement, fallbackClass);
        }
      }

      if (['association', 'generalization', 'aggregation', 'composition', 'dependency'].includes(type)) {
        this.relationshipService.startLinkCreation(
          (this.diagramService as any)['paper'],
          this.paperContainer.nativeElement,
          type
        );
        console.log(`Modo de creación de relación activado: ${type}`);
      }
    });
  }

  exportJSON() {
    const json = this.diagramService.exportFullDiagramAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uml-diagram.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
