import { Routes } from '@angular/router';
import { Diagram } from './diagram/diagram';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  {
    path: '', redirectTo: 'home', pathMatch: 'full'
  },
  {
    path: 'diagram', component: Diagram
  },
  {
    path: 'home', component: HomeComponent
  }
];
