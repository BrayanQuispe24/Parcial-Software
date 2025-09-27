import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WsUrlService {
  private base(host = window.location.hostname, port?: number) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const portPart = port ? `:${port}` : '';
    return `${scheme}://${host}${portPart}`;
  }

  chat(room: string, host?: string, port = 8000) {
    return `${this.base(host, port)}/wss/chat/${encodeURIComponent(room)}/`;
  }

  diagram(diagramId: string, token?: string, host?: string, port = 8000) {
    const base = `${this.base(host, port)}/wss/diagram/${encodeURIComponent(diagramId)}/`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }


  constructor() { }

}
