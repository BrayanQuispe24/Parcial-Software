import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-side-panel',
  imports: [CommonModule, DragDropModule],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.css'
})
export class SidePanel {
  @Output() elementDragged = new EventEmitter<CdkDragEnd>();
  @Output() exportRequested = new EventEmitter<void>(); // 👈 nuevo evento
  onDragEnded(event: CdkDragEnd) {
    // Enviamos el evento al componente padre (diagram)
    this.elementDragged.emit(event);

    // Importante: restablecemos la transformación para que el elemento original vuelva a su posición
    // y no se quede donde fue soltado
    event.source.reset();
  }
  onExportClick() {
  this.exportRequested.emit();
}
}
