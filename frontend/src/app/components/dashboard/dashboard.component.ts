import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IncidentService, Incident } from '../../services/incident.service';
import { DeviceService, Device } from '../../services/device.service';
import { DiagnosticModalComponent } from '../shared/diagnostic-modal.component';
import { Subscription, interval } from 'rxjs';

const CIRC = 2 * Math.PI * 52; // circunferência do donut (r = 52)

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DiagnosticModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  incidents: Incident[] = [];
  devices: Device[] = [];

  currentTime = '';
  availability = 100;
  onlineCount = 0;
  offlineCount = 0;
  maintenanceCount = 0;
  avgLatency = 0;
  maxLatency = 0;
  minLatency = 0;
  proximoPingEm = 30;

  notificacao: string | null = null;
  timelineData: any[] = [];
  onlinePercent = 0;
  offlinePercent = 0;

  diagIp: string | null = null;
  readonly escala = [0, 50, 100, 150, 200];
  readonly sevLabel: Record<string, string> = { CRITICAL: 'Crítico', HIGH: 'Alto', MEDIUM: 'Médio', LOW: 'Baixo' };

  private refreshSub: Subscription | null = null;
  private countdownSub: Subscription | null = null;
  private toastTimer: any = null;

  private audioCtx: AudioContext | null = null;
  private lastOfflineCount = 0;
  private primeiraCarga = true;

  constructor(
    private incidentService: IncidentService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.atualizarHorario();
    this.carregarDados();

    // O contexto de áudio só pode ser criado após um gesto do usuário
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
    clearTimeout(this.toastTimer);
  }

  /* ---- Estado exibido no cabeçalho ---- */
  get estado(): 'vazio' | 'ok' | 'falha' {
    if (this.devices.length === 0) return 'vazio';
    return this.offlineCount > 0 ? 'falha' : 'ok';
  }

  get titulo(): string {
    if (this.estado === 'vazio') return 'Nenhum ativo monitorado';
    if (this.estado === 'ok') return 'Rede sem falhas';
    return this.offlineCount === 1 ? '1 ativo fora do ar' : `${this.offlineCount} ativos fora do ar`;
  }

  get resumo(): string {
    if (this.estado === 'vazio') return 'Cadastre dispositivos para começar a monitorar.';
    const base = `${this.onlineCount} de ${this.devices.length} ativos respondendo`;
    return this.maintenanceCount > 0 ? `${base}, ${this.maintenanceCount} em manutenção` : base;
  }

  get progresso(): number { return (this.proximoPingEm / 30) * 100; }

  /* ---- Donut ---- */
  get dashOnline(): string { return `${(this.onlinePercent / 100) * CIRC} ${CIRC}`; }
  get dashOffline(): string { return `${(this.offlinePercent / 100) * CIRC} ${CIRC}`; }
  get offsetOffline(): number { return -(this.onlinePercent / 100) * CIRC; }

  atualizarHorario() {
    this.currentTime = new Date().toLocaleTimeString('pt-BR');
  }

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

      this.onlineCount = devices.filter(d => d.status === 'UP').length;
      this.offlineCount = devices.filter(d => d.status !== 'UP' && !d.maintenance).length;
      this.maintenanceCount = devices.filter(d => d.status !== 'UP' && d.maintenance).length;

      const total = devices.length;
      this.availability = total === 0 ? 100 : Math.round((this.onlineCount / total) * 100);
      this.onlinePercent = total === 0 ? 0 : Math.round((this.onlineCount / total) * 100);
      this.offlinePercent = total === 0 ? 0 : Math.round((this.offlineCount / total) * 100);

      // Alerta quando surgem novos dispositivos offline (não dispara na primeira carga)
      if (!this.primeiraCarga && this.offlineCount > this.lastOfflineCount) {
        this.tocarAlerta();
        this.mostrarNotificacao('Novo dispositivo fora do ar.');
      }
      this.lastOfflineCount = this.offlineCount;
      this.primeiraCarga = false;

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
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.notificacao = null, 5000);
  }

  larguraBarra(latency?: number | null): number {
    if (latency == null) return 0;
    return Math.min((latency / 200) * 100, 100);
  }

  abrirDiagnostico(ip: string) { this.diagIp = ip; }

  testarPing(): void {
    this.carregarDados();
    this.atualizarHorario();
    this.mostrarNotificacao('Dados atualizados.');
    this.proximoPingEm = 30;
  }
}
