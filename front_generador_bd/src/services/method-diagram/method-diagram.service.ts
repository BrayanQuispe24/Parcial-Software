import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { diagramaCreate, diagramaResponse } from '../../models/diagrama.model';
import { Observable } from 'rxjs';
import { DiagramWsService } from '../realtime/diagram-ws.service';
import { DiagramService } from '../diagram.service';

@Injectable({
  providedIn: 'root'
})
export class MethodDiagramService {
  private http = inject(HttpClient);
  private API = environment.baseUrl; // 👈 usa API REST, no wsBaseUrl
  private ws = inject(DiagramWsService);
  private diagramService = inject(DiagramService);

  createDiagram(diagram: diagramaCreate): Observable<diagramaResponse> {
    return this.http.post<diagramaResponse>(`${this.API}/api/rooms/create/`, diagram, {
      headers: { 'Content-Type': 'application/json' }
    });
  }


  openDiagram(wsUrl: string) {
    if (!wsUrl) {
      console.error("❌ No se encontró wsUrl:", wsUrl);
      return;
    }
    console.log("🌐 Conectar a:", wsUrl);

    // 👉 conectar al WebSocket del room
    this.ws.connect(wsUrl);
    // 👉 enganchar el WS al servicio de diagramas
    this.diagramService.attachWs(this.ws);
  }


  listDiagrams(): Observable<{ data: diagramaResponse[] }> {
    return this.http.get<{ data: diagramaResponse[] }>(`${this.API}/api/rooms/listar/`);
  }
}
