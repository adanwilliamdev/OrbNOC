import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncidentService, Incident } from '../../services/incident.service';
import { DeviceService, Device } from '../../services/device.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  incidents: Incident[] = [];
  devices: Device[] = [];
  latencyData: any[] = [];

  currentTime: string = '';

  availability = 100;
  onlineCount = 0;
  offlineCount = 0;
  avgLatency = 0;

  constructor(
    private incidentService: IncidentService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.currentTime = new Date().toLocaleTimeString('pt-BR');
    this.carregarDados();
  }

  carregarDados(): void {
    this.deviceService.list().subscribe(devices => {
      this.devices = devices;
      this.onlineCount = devices.filter(d => d.status === 'UP').length;
      this.offlineCount = devices.filter(d => d.status !== 'UP').length;
      this.calcularMetricas();
    });

    this.incidentService.list().subscribe(incidents => {
      this.incidents = incidents;
    });
  }

  calcularMetricas(): void {
    if (this.devices.length === 0) {
      this.availability = 100;
      this.avgLatency = 0;
      this.latencyData = [];
      return;
    }

    this.availability = Math.round((this.onlineCount / this.devices.length) * 100);

    const alvos = ['Mail (SMTP)', 'Link ET', 'Intranet', 'Cloud', 'Google', 'Instagram'];
    this.latencyData = alvos.map(alvo => {
      const lat = Math.floor(Math.random() * 40) + 10;
      return { name: alvo, latency: lat, width: Math.min(lat * 1.5, 100) };
    });

    this.avgLatency = Math.round(
      this.latencyData.reduce((acc, curr) => acc + curr.latency, 0) / this.latencyData.length
    );
  }

  testarPing(): void {
    this.calcularMetricas();
    this.currentTime = new Date().toLocaleTimeString('pt-BR');
  }
}