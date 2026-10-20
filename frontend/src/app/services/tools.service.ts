import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ToolsService {
  private base = 'http://localhost:8080/api';
  constructor(private http: HttpClient) {}
  topology(): Observable<any> { return this.http.get<any>(`${this.base}/topology`); }
  dns(host: string): Observable<any> { return this.http.get<any>(`${this.base}/tools/dns/${host}`); }
  whois(host: string): Observable<any> { return this.http.get<any>(`${this.base}/tools/whois/${host}`); }
  audit(): Observable<any[]> { return this.http.get<any[]>(`${this.base}/audit`); }
  alerts(): Observable<any[]> { return this.http.get<any[]>(`${this.base}/alerts`); }
}