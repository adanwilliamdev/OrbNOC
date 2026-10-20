import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IncidentService, Incident } from '../../services/incident.service';
import { DeviceService, Device, DiagResult } from '../../services/device.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  incidents: Incident[] = [];
  devices: Device[] = [];

  currentTime: string = '';
  availability = 100;
  onlineCount = 0;
  offlineCount = 0;
  avgLatency = 0;
  maxLatency = 0;
  minLatency = 0;
  proximoPingEm = 30;
  notificacao: string | null = null;

  // Diagnostico
  diagModalAberto = false;
  diagLoading = false;
  diagResultado: DiagResult | null = null;
  diagIpAtual = '';

  // Campos do template legado (mantidos por compatibilidade)
  latencyData: any[] = [];
  testarPing(): void {
    this.carregarDados();
    this.atualizarHorario();
    this.mostrarNotificacao('Pings atualizados.');
    this.proximoPingEm = 30;
  }

  private refreshSub: Subscription | null = null;
  private countdownSub: Subscription | null = null;

  constructor(
    private incidentService: IncidentService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.atualizarHorario();
    this.carregarDados();

    this.refreshSub = interval(30000).subscribe(() => {
      this.atualizarHorario();
      this.carregarDados();
      this.proximoPingEm = 30;
    });

    this.countdownSub = interval(1000).subscribe(() => {
      if (this.proximoPingEm > 0) this.proximoPingEm--;
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.countdownSub?.unsubscribe();
  }

  atualizarHorario() {
    this.currentTime = new Date().toLocaleTimeString('pt-BR');
  }

  carregarDados(): void {
    this.deviceService.list().subscribe(devices => {
      const prevOffline = this.offlineCount;
      this.devices = devices;
      this.onlineCount = devices.filter(d => d.status === 'UP').length;
      this.offlineCount = devices.filter(d => d.status !== 'UP').length;

      const latencias = devices
        .filter(d => d.status === 'UP' && d.latency != null)
        .map(d => d.latency as number);

      if (latencias.length > 0) {
        this.avgLatency = Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length);
        this.minLatency = Math.min(...latencias);
        this.maxLatency = Math.max(...latencias);
      } else {
        this.avgLatency = 0; this.minLatency = 0; this.maxLatency = 0;
      }

      this.availability = devices.length === 0 ? 100 : Math.round((this.onlineCount / devices.length) * 100);

      // Atualiza latencyData (formato antigo do template)
      this.latencyData = devices.map(d => ({
        name: d.hostname,
        latency: d.latency ?? 0,
        width: d.latency ? Math.min((d.latency / 200) * 100, 100) : 0,
        status: d.status
      }));

      if (prevOffline > 0 && this.offlineCount > prevOffline) {
        this.mostrarNotificacao('Atencao: novo dispositivo OFFLINE detectado!');
      }
    });

    this.incidentService.list().subscribe(incidents => {
      this.incidents = incidents;
    });
  }

  mostrarNotificacao(msg: string) {
    this.notificacao = msg;
    setTimeout(() => this.notificacao = null, 5000);
  }

  larguraBarra(latency?: number | null): number {
    if (latency == null) return 0;
    return Math.min((latency / 200) * 100, 100);
  }

  // ---------- Diagnostico ----------
  abrirDiagnostico(ip: string) {
    this.diagIpAtual = ip;
    this.diagModalAberto = true;
    this.diagResultado = null;
    this.diagLoading = false;
  }
  fecharDiagnostico() {
    this.diagModalAberto = false;
  }
  rodarPingDiag() {
    this.diagLoading = true;
    this.deviceService.ping(this.diagIpAtual).subscribe({
      next: (res) => { this.diagResultado = res; this.diagLoading = false; },
      error: () => { this.diagLoading = false; }
    });
  }
  rodarTracerouteDiag() {
    this.diagLoading = true;
    this.deviceService.traceroute(this.diagIpAtual).subscribe({
      next: (res) => { this.diagResultado = res; this.diagLoading = false; },
      error: () => { this.diagLoading = false; }
    });
  }
}