import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Device {
  id?: number;
  hostname: string;
  ipAddress: string;
  deviceType: string;
  status: string;
  location: string;
  latency?: number | null;
  tags?: string;
  maintenance?: boolean;
  monitorUrl?: string;
}

export interface DiagResult {
  status: string;
  ip: string;
  message?: string;
  log?: string;
  latency?: number;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private apiUrl = 'http://localhost:8080/api/devices';
  private diagUrl = 'http://localhost:8080/api/diagnostics';
  private toolsUrl = 'http://localhost:8080/api/tools';

  constructor(private http: HttpClient) {}

  list(): Observable<Device[]> { return this.http.get<Device[]>(this.apiUrl); }
  create(d: Device): Observable<Device> { return this.http.post<Device>(this.apiUrl, d); }
  update(id: number, d: Device): Observable<Device> { return this.http.put<Device>(`${this.apiUrl}/${id}`, d); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`); }

  ping(ip: string): Observable<DiagResult> { return this.http.get<DiagResult>(`${this.diagUrl}/ping/${ip}`); }
  traceroute(ip: string): Observable<DiagResult> { return this.http.get<DiagResult>(`${this.diagUrl}/traceroute/${ip}`); }
  portscan(ip: string): Observable<any> { return this.http.get<any>(`${this.toolsUrl}/portscan/${ip}`); }
  networkscan(subnet: string): Observable<any> { return this.http.get<any>(`${this.toolsUrl}/networkscan/${subnet}`); }
}