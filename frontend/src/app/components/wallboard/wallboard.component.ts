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
    <div class="wallboard">
      <header class="wb-header">
        <div class="wb-brand">OrbNOC — Modo TV</div>
        <div class="wb-time">{{ currentTime }}</div>
        <button class="btn-outline" (click)="sair()">Sair (ESC)</button>
      </header>

      <div class="wb-grid">
        <div class="wb-card">
          <h2>Disponibilidade</h2>
          <div class="wb-value" [class.text-danger]="availability < 100">{{ availability }}%</div>
        </div>
        <div class="wb-card">
          <h2>Online</h2>
          <div class="wb-value text-success">{{ onlineCount }}</div>
        </div>
        <div class="wb-card">
          <h2>Offline</h2>
          <div class="wb-value" [class.text-danger]="offlineCount > 0">{{ offlineCount }}</div>
        </div>
      </div>

      <div class="wb-devices">
        <h2>Status dos Dispositivos</h2>
        <div class="wb-list">
          <div *ngFor="let d of devices" class="wb-device" [class.down]="d.status !== 'UP'">
            <span class="wb-dot"></span>
            <span class="wb-name">{{ d.hostname }}</span>
            <span class="wb-latency">{{ d.latency ? d.latency + 'ms' : 'DOWN' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wallboard { background: #05070C; height: 100vh; color: #fff; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans'; }
    .wb-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1F2937; padding-bottom: 20px; margin-bottom: 40px; }
    .wb-brand { font-size: 24px; font-weight: 700; color: #FBBF24; }
    .wb-time { font-size: 24px; font-family: monospace; }
    .wb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin-bottom: 40px; }
    .wb-card { background: #111827; padding: 40px; border-radius: 16px; text-align: center; border: 1px solid #1F2937; }
    .wb-card h2 { margin: 0 0 20px 0; font-size: 20px; color: #9CA3AF; text-transform: uppercase; }
    .wb-value { font-size: 80px; font-weight: 800; line-height: 1; }
    .text-success { color: #10B981; }
    .text-danger { color: #EF4444; }
    .wb-devices { flex: 1; background: #111827; border-radius: 16px; padding: 40px; border: 1px solid #1F2937; overflow: hidden; display: flex; flex-direction: column; }
    .wb-devices h2 { margin: 0 0 20px 0; color: #9CA3AF; font-size: 18px; text-transform: uppercase; }
    .wb-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; overflow-y: auto; }
    .wb-device { display: flex; align-items: center; background: #090D16; padding: 15px 20px; border-radius: 8px; border: 1px solid #1F2937; }
    .wb-device.down { border-color: #7F1D1D; background: rgba(127, 29, 29, 0.2); }
    .wb-dot { width: 12px; height: 12px; border-radius: 50%; background: #10B981; margin-right: 15px; box-shadow: 0 0 10px #10B981; }
    .wb-device.down .wb-dot { background: #EF4444; box-shadow: 0 0 10px #EF4444; animation: blink 1s infinite; }
    .wb-name { flex: 1; font-size: 18px; font-weight: 600; }
    .wb-latency { font-family: monospace; font-size: 16px; color: #9CA3AF; }
    @keyframes blink { 50% { opacity: 0.5; } }
  `]
})
export class WallboardComponent implements OnInit, OnDestroy {
  devices: Device[] = [];
  onlineCount = 0;
  offlineCount = 0;
  availability = 100;
  currentTime = '';
  private sub: Subscription | null = null;

  constructor(private deviceService: DeviceService, private router: Router) {}

  ngOnInit(): void {
    this.atualizarHora();
    this.carregar();
    this.sub = interval(10000).subscribe(() => { this.carregar(); this.atualizarHora(); });

    // Tecla ESC para sair
    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    window.removeEventListener('keydown', this.handleEsc);
  }

  handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.sair(); };

  atualizarHora() { this.currentTime = new Date().toLocaleTimeString('pt-BR'); }

  carregar() {
    this.deviceService.list().subscribe(d => {
      this.devices = d;
      this.onlineCount = d.filter(x => x.status === 'UP').length;
      this.offlineCount = d.filter(x => x.status !== 'UP').length;
      this.availability = d.length === 0 ? 100 : Math.round((this.onlineCount / d.length) * 100);
    });
  }

  sair() { this.router.navigate(['/dashboard']); }
}