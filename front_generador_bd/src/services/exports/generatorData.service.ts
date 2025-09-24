import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeneratorDataService {
  private http = inject(HttpClient);
  private API = environment.baseUrl;


  generatorDataSql(diagrama: any): Observable<any> {
    const diagram = diagrama;
    return this.http.post<any>(`${this.API}/api/fixtures/generate-sql/`, { diagram })
  }

  downloadFile(content: string, fileName: string, contentType: string): void {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }


  constructor() { }

}
