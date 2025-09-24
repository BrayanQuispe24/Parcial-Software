import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DiagramWsService } from '../../services/realtime/diagram-ws.service';
import { DiagramService } from '../../services/diagram.service';
import { MethodDiagramService } from '../../services/method-diagram/method-diagram.service';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private router = inject(Router);
  private wsService = inject(DiagramWsService);
  private diagramService = inject(DiagramService);
  private methodServiceDiagram = inject(MethodDiagramService);

  nombreDiagrama = signal<string>('');
  url = signal<string>('');

  onCreateDiagram() {
    const name = this.nombreDiagrama().trim() || "Diagrama nuevo";

    this.methodServiceDiagram.createDiagram({ name }).subscribe({
      next: (res) => {
        console.log("🟢 Diagrama creado:", res);
        localStorage.setItem('url', res.wsUrl);
        this.router.navigate(['/diagram']);
      },
      error: (err) => {
        console.error("❌ Error al crear diagrama:", err);
      }
    });
  }

  onConnectDiagram() {
    const url = this.url().trim();
    if (!url) {
      console.warn("⚠️ URL vacía, no se puede conectar");
      return;
    }
    localStorage.setItem('url', url);
    // 👉 Redirigir también
    this.router.navigate(['/diagram']);
  }
}
