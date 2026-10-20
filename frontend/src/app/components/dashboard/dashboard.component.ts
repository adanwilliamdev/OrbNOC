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
  
  // Alertas e Notificações
  notificacao: string | null = null;
  timelineData: any[] = [];
  onlinePercent = 0;
  offlinePercent = 0;

  // Diagnóstico no Dashboard
  diagModalAberto = false;
  diagLoading = false;
  diagResultado: DiagResult | null = null;
  diagIpAtual = '';
  latencyData: any[] = [];

  private refreshSub: Subscription | null = null;
  private countdownSub: Subscription | null = null;
  
  // Áudio
  private audioCtx: AudioContext | null = null;
  private lastOfflineCount = 0;

  constructor(
    private incidentService: IncidentService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.atualizarHorario();
    this.carregarDados();

    // Inicializa o contexto de áudio no primeiro clique (regra dos navegadores)
    document.addEventListener('click', () => {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }, { once: true });

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

  // SOM DE ALERTA
  tocarAlerta() {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.5);
  }

  carregarDados(): void {
    this.deviceService.list().subscribe(devices => {
      this.devices = devices;
      
      // Contadores
      this.onlineCount = devices.filter(d => d.status === 'UP').length;
      this.offlineCount = devices.filter(d => d.status !== 'UP' && !d.maintenance).length;
      
      // Porcentagens
      this.availability = devices.length === 0 ? 100 : Math.round((this.onlineCount / devices.length) * 100);
      this.onlinePercent = devices.length === 0 ? 0 : Math.round((this.onlineCount / devices.length) * 100);
      this.offlinePercent = devices.length === 0 ? 0 : Math.round((this.offlineCount / devices.length) * 100);

      // Toca o som se um novo dispositivo ficou offline
      if (this.offlineCount > this.lastOfflineCount && this.lastOfflineCount !== 0) {
        this.tocarAlerta();
        this.mostrarNotificacao('Atenção: Novo dispositivo OFFLINE detectado!');
      }
      this.lastOfflineCount = this.offlineCount;

      // Latências
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

      // Formato para o Gráfico de Barras
      this.latencyData = devices.map(d => ({
        name: d.hostname,
        latency: d.latency ?? 0,
        width: d.latency ? Math.min((d.latency / 200) * 100, 100) : 0,
        status: d.status
      }));
    });

    this.incidentService.list().subscribe(incidents => {
      this.incidents = incidents;
    });
    
    this.gerarTimeline();
  }

  gerarTimeline() {
    const agora = new Date().getHours();
    this.timelineData = [];
    for (let i = 23; i >= 0; i--) {
      const hora = (agora - i + 24) % 24;
      const status = i === 0 ? 'gray' : (i === 5 ? 'yellow' : 'green');
      const percent = i === 5 ? 95.5 : (i === 0 ? '--' : 100);
      this.timelineData.push({ 
        hora: hora.toString().padStart(2, '0') + ':00', 
        status: status, 
        percent: percent 
      });
    }
  }

  mostrarNotificacao(msg: string) {
    this.notificacao = msg;
    setTimeout(() => this.notificacao = null, 5000);
  }

  larguraBarra(latency?: number | null): number {
    if (latency == null) return 0;
    return Math.min((latency / 200) * 100, 100);
  }

  // --- Ações do Diagnóstico ---
  abrirDiagnostico(ip: string) {
    this.diagIpAtual = ip;
    this.diagModalAberto = true;
    this.diagResultado = null;
    this.diagLoading = false;
  }

  fecharDiagnostico() { this.diagModalAberto = false; }
  
  testarPing(): void {
    this.carregarDados();
    this.atualizarHorario();
    this.mostrarNotificacao('Dados atualizados com sucesso.');
    this.proximoPingEm = 30;
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