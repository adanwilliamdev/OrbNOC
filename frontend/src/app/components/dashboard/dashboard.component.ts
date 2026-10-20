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
  carregando = true;
  erro: string | null = null;

  constructor(
    private incidentService: IncidentService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.carregarTudo();
  }

  carregarTudo(): void {
    this.carregando = true;
    this.erro = null;
    this.incidentService.list().subscribe({
      next: (data) => {
        this.incidents = data;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = 'Falha ao carregar incidentes. Backend rodando em localhost:8080?';
        this.carregando = false;
        console.error(err);
      }
    });
    this.deviceService.list().subscribe({
      next: (data) => (this.devices = data),
      error: (err) => console.error(err)
    });
  }

  criarIncidenteExemplo(): void {
    this.incidentService.create({
      title: 'Link principal caiu',
      description: 'Rota SP-RJ sem conectividade',
      severity: 'CRITICAL',
      status: 'OPEN'
    }).subscribe({
      next: () => this.incidentService.list().subscribe(d => (this.incidents = d)),
      error: (err) => {
        this.erro = 'Falha ao criar incidente.';
        console.error(err);
      }
    });
  }

  criarDeviceExemplo(): void {
    this.deviceService.create({
      hostname: 'core-sw-01',
      ipAddress: '10.0.0.1',
      deviceType: 'SWITCH',
      status: 'UP',
      location: 'Datacenter SP'
    }).subscribe({
      next: () => this.deviceService.list().subscribe(d => (this.devices = d)),
      error: (err) => console.error(err)
    });
  }
}