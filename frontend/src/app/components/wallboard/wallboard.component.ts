import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeviceService, Device } from '../../services/device.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-wallboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wallboard" [class.falha]="offlineCount > 0">
      <header class="wb-header">
        <div class="wb-brand">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <rect width="48" height="48" rx="10" fill="#0A0F15" stroke="rgba(251,191,36,0.28)"/>
            <circle cx="24" cy="24" r="14" fill="none" stroke="#FBBF24" stroke-width="2.5" stroke-dasharray="66 22" stroke-linecap="round" transform="rotate(-45 24 24)"/>
            <circle cx="24" cy="24" r="4" fill="#FBBF24"/>
            <circle cx="38" cy="24" r="2.5" fill="#3DCC91"/>
          </svg>
          <span>OrbNOC</span>
        </div>
        <div class="wb-clock">
          <span class="wb-time num">{{ currentTime }}</span>
          <span class="wb-date">{{ currentDate }}</span>
        </div>
        <div class="wb-actions">
          <button type="button" class="btn-outline" (click)="telaCheia()">Tela cheia</button>
          <button type="button" class="btn-outline" (click)="sair()">Sair <kbd>Esc</kbd></button>
        </div>
      </header>

      <section class="wb-summary">
        <div class="wb-status">
          <span class="wb-led"></span>
          <div>
            <div class="wb-headline">{{ titulo }}</div>
            <div class="wb-sub">{{ onlineCount }} de {{ devices.length }} ativos respondendo</div>
          </div>
        </div>
        <div class="wb-stat">
          <span class="wb-num num" [class.bad]="availability < 100">{{ availability }}<small>%</small></span>
          <span class="wb-label">Disponibilidade</span>
        </div>
        <div class="wb-stat">
          <span class="wb-num num ok">{{ onlineCount }}</span>
          <span class="wb-label">Online</span>
        </div>
        <div class="wb-stat">
          <span class="wb-num num" [class.bad]="offlineCount > 0">{{ offlineCount }}</span>
          <span class="wb-label">Offline</span>
        </div>
      </section>

      <section class="wb-devices">
        <div class="wb-grid">
          <div *ngFor="let d of ordenados" class="wb-device" [class.down]="d.status !== 'UP' && !d.maintenance" [class.mute]="d.status !== 'UP' && d.maintenance">
            <span class="wb-dot"></span>
            <span class="wb-name">{{ d.hostname }}</span>
            <span class="wb-latency num">{{ d.status === 'UP' ? (d.latency != null ? d.latency + ' ms' : 'online') : (d.maintenance ? 'manutenção' : 'fora do ar') }}</span>
          </div>
          <div class="wb-empty" *ngIf="devices.length === 0">Nenhum dispositivo monitorado.</div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .wallboard {
      --c: var(--ok);
      height: 100vh; display: flex; flex-direction: column; gap: 2.2vh; padding: 3vh 3vw;
      background: var(--bg); color: var(--text);
    }
    .wallboard.falha { --c: var(--crit); }

    .wb-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; }
    .wb-brand { display: flex; align-items: center; gap: 14px; font-size: clamp(20px, 2.2vw, 32px); font-weight: 600; letter-spacing: -0.02em; }
    .wb-brand svg { width: clamp(32px, 3vw, 46px); height: clamp(32px, 3vw, 46px); }
    .wb-clock { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
    .wb-time { font-family: var(--font-mono); font-size: clamp(32px, 4.4vw, 68px); font-weight: 500; letter-spacing: -0.02em; }
    .wb-date { font-size: clamp(12px, 1.1vw, 18px); color: var(--text-3); margin-top: 4px; }
    .wb-actions { display: flex; gap: 10px; justify-content: flex-end; }

    .wb-summary {
      display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)); gap: 1px;
      background: var(--line); border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden;
    }
    .wb-summary > * { background: var(--surface); padding: 3vh 2vw; }
    .wb-status { display: flex; align-items: center; gap: 1.6vw; }
    .wb-led { width: clamp(16px, 1.8vw, 28px); height: clamp(16px, 1.8vw, 28px); border-radius: 50%; background: var(--c); box-shadow: 0 0 0 8px color-mix(in srgb, var(--c) 18%, transparent); flex-shrink: 0; }
    .falha .wb-led { animation: pulse 1.2s ease-in-out infinite; }
    .wb-headline { font-size: clamp(22px, 2.8vw, 44px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
    .wb-sub { font-size: clamp(13px, 1.2vw, 20px); color: var(--text-2); margin-top: 4px; }
    .wb-stat { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
    .wb-num { font-size: clamp(44px, 6.4vw, 104px); font-weight: 500; letter-spacing: -0.04em; line-height: 1; }
    .wb-num small { font-size: .4em; color: var(--text-3); margin-left: 4px; letter-spacing: 0; }
    .wb-num.ok { color: var(--ok); }
    .wb-num.bad { color: var(--crit); }
    .wb-label { font-size: clamp(13px, 1.2vw, 20px); color: var(--text-2); }

    .wb-devices { flex: 1; min-height: 0; overflow: auto; }
    .wb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(240px, 22vw, 380px), 1fr)); gap: 1.2vh 1vw; }
    .wb-device {
      display: flex; align-items: center; gap: 14px; padding: 2vh 1.4vw;
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
    }
    .wb-device.down { border-color: var(--crit-line); background: color-mix(in srgb, var(--crit) 9%, var(--surface)); }
    .wb-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--ok); flex-shrink: 0; }
    .wb-device.down .wb-dot { background: var(--crit); animation: pulse 1.2s ease-in-out infinite; }
    .wb-device.mute .wb-dot { background: var(--text-3); }
    .wb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(15px, 1.5vw, 24px); font-weight: 500; }
    .wb-latency { font-family: var(--font-mono); font-size: clamp(13px, 1.2vw, 20px); color: var(--text-2); white-space: nowrap; }
    .wb-device.down .wb-latency { color: var(--crit); }
    .wb-empty { color: var(--text-3); font-size: clamp(14px, 1.4vw, 22px); padding: 2vh 0; }

    @media (max-width: 900px) {
      .wb-header { grid-template-columns: 1fr; justify-items: start; }
      .wb-clock { align-items: flex-start; }
      .wb-actions { justify-content: flex-start; }
      .wb-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .wb-status { grid-column: 1 / -1; }
      .wallboard { height: auto; min-height: 100vh; }
    }
  `]
})
export class WallboardComponent implements OnInit, OnDestroy {
  devices: Device[] = [];
  onlineCount = 0;
  offlineCount = 0;
  availability = 100;
  currentTime = '';
  currentDate = '';
  private sub: Subscription | null = null;
  private clockSub: Subscription | null = null;

  constructor(private deviceService: DeviceService, private router: Router) {}

  ngOnInit(): void {
    this.atualizarHora();
    this.carregar();
    this.sub = interval(10000).subscribe(() => this.carregar());
    this.clockSub = interval(1000).subscribe(() => this.atualizarHora());
    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.clockSub?.unsubscribe();
    window.removeEventListener('keydown', this.handleEsc);
    if (document.fullscreenElement) document.exitFullscreen?.();
  }

  handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.sair(); };

  get titulo(): string {
    if (this.devices.length === 0) return 'Sem ativos monitorados';
    if (this.offlineCount === 0) return 'Rede sem falhas';
    return this.offlineCount === 1 ? '1 ativo fora do ar' : `${this.offlineCount} ativos fora do ar`;
  }

  // Ativos com falha aparecem primeiro
  get ordenados(): Device[] {
    const peso = (d: Device) => d.status === 'UP' ? 2 : (d.maintenance ? 1 : 0);
    return [...this.devices].sort((a, b) => peso(a) - peso(b) || a.hostname.localeCompare(b.hostname));
  }

  atualizarHora() {
    const agora = new Date();
    this.currentTime = agora.toLocaleTimeString('pt-BR');
    this.currentDate = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  carregar() {
    this.deviceService.list().subscribe(d => {
      this.devices = d;
      this.onlineCount = d.filter(x => x.status === 'UP').length;
      this.offlineCount = d.filter(x => x.status !== 'UP' && !x.maintenance).length;
      this.availability = d.length === 0 ? 100 : Math.round((this.onlineCount / d.length) * 100);
    });
  }

  telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }

  sair() { this.router.navigate(['/dashboard']); }
}
