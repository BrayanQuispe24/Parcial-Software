import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeneratorBackendService {
  private http = inject(HttpClient);
  private API = environment.generatorUrl;

  //vamos a empezar a crear el metodo para generar el backend
  createBackend(nombre: string, diagrama: any): Observable<Blob> {
    return this.http.post<Blob>(
      `${this.API}/generate/uml?groupId=com.uagrm&artifactId=${nombre}&packageBase=com.uagrm.pet&db=postgres`,
      diagrama, // 👈 objeto JSON, no string
      {
        responseType: 'blob' as 'json' // 👈 necesario para TypeScript
      }
    );
  }



  constructor() { }

}
