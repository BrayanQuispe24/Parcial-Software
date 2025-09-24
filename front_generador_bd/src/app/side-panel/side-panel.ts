import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { MethodDiagramService } from '../../services/method-diagram/method-diagram.service';
import { diagramaCreate } from '../../models/diagrama.model';
import { WsUrlService } from '../../services/realtime/ws-url.service';
import { DiagramWsService } from '../../services/realtime/diagram-ws.service';
import { DiagramService } from '../../services/diagram.service';
import { GeneratorBackendService } from '../../services/exports/generatorBackend.service';
import { GeneratorDataService } from '../../services/exports/generatorData.service';

@Component({
  selector: 'app-side-panel',
  imports: [CommonModule, DragDropModule],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.css'
})
export class SidePanel {
  private ws = inject(DiagramWsService);
  private diagramService = inject(DiagramService);
  private methodServiceDiagram = inject(MethodDiagramService);
  private generadorBackend = inject(GeneratorBackendService);
  private diagramWsService = inject(DiagramWsService);
  private fixtureService = inject(GeneratorDataService);
  @Output() elementDragged = new EventEmitter<CdkDragEnd>();
  @Output() exportRequested = new EventEmitter<void>(); // 👈 nuevo evento
  bandera = signal<boolean>(true);
  nombre = signal<string>('');
  url = signal<string>('');
  nombreBackend = signal<string>('');
  promp = signal<string>('');

  onDragEnded(event: CdkDragEnd) {
    this.elementDragged.emit(event);
    event.source.reset();
  }
  onExportClick() {
    this.exportRequested.emit();
  }


  onDisconnect(): void {
    this.diagramWsService.disconnect();
    localStorage.removeItem('url');
    console.log('url removido:');
    // 🔹 Limpiar el canvas
    //this.diagramService['graph']?.clear();
    window.location.href='/home';

  }

  copyToClipboard() {
    const text = localStorage.getItem('url') || '';
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log("✅ Copiado al portapapeles:", text);
      })
      .catch(err => {
        console.error("❌ Error al copiar:", err);
      });
  }

  downloadUrl() {
    const url = localStorage.getItem('url') || '';
    if (!url) return;

    const blob = new Blob([url], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'room-url.txt'; // 👈 nombre del archivo
    link.click();
    URL.revokeObjectURL(link.href);
  }

  onGenerateBackend() {
    const json = this.diagramService.exportFullDiagramAsJson();
    // `json` ya es un string JSON; conviértelo a objeto:
    const obj = JSON.parse(json);

    this.generadorBackend.createBackend(this.nombreBackend(), obj).subscribe((zipBlob) => {
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.nombreBackend()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }

  onSendPromp(): void {
    const prompClean: string = this.promp().toLocaleLowerCase().trim();
    if (prompClean.length == 0) return;
    this.diagramWsService.sendPrompt(prompClean);
    this.promp.set('');
  }

  onGenerateSql() {
    const diagram = this.diagramService.exportFullDiagramAsJson();
    this.fixtureService.generatorDataSql(diagram).subscribe(res => {
      const sqlContent = res.sql.join('\n'); // junta los INSERT en un string
      this.fixtureService.downloadFile(sqlContent, 'Datos.sql', 'text/sql');
    });
  }




}







