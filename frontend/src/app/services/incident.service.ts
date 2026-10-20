import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Incident {
  id?: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private apiUrl = 'http://localhost:8080/api/incidents';

  constructor(private http: HttpClient) {}

  list(): Observable<Incident[]> {
    return this.http.get<Incident[]>(this.apiUrl);
  }
  create(i: Incident): Observable<Incident> {
    return this.http.post<Incident>(this.apiUrl, i);
  }
  update(id: number, i: Incident): Observable<Incident> {
    return this.http.put<Incident>(`${this.apiUrl}/${id}`, i);
  }
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}