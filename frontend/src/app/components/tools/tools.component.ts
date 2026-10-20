import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../../services/device.service';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div class="title-area">
          <h1>Ferramentas de Diagnóstico</h1>
          <p class="subtitle">Ping, Traceroute, DNS, Port Scan e Network Discovery</p>
        </div>
      </div>

      <div class="tools-layout">
        <div class="panel form-panel">
          <h2>Consulta</h2>
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div class="field">
              <label>Host / IP / Sub-rede</label>
              <input type="text" placeholder="Ex: 8.8.8.8 ou 192.168.1" [(ngModel)]="target">
            </div>
            <div class="field">
              <label>Comando</label>
              <select [(ngModel)]="mode">
                <option value="ping">Ping (ICMP)</option>
                <option value="portscan">Port Scanner (Nmap básico)</option>
                <option value="networkscan">Network Discovery (Sub-rede /24)</option>
              </select>
            </div>
            <button class="btn-primary" (click)="executar()" [disabled]="loading || !target">
              {{ loading ? 'Executando...' : '▶ Executar' }}
            </button>
          </div>
        </div>

        <div class="panel terminal-panel">
          <div class="terminal-header">
            <span class="term-dot red"></span>
            <span class="term-dot yellow"></span>
            <span class="term-dot green"></span>
            <span class="term-title">orbnoc&#64;terminal:~</span>
          </div>
          <div class="terminal-body">
            <div *ngIf="historico.length === 0" class="terminal-empty">Aguardando comando...<span class="cursor-blink">_</span></div>
            <div *ngFor="let linha of historico" class="terminal-line" [ngClass]="linha.tipo">
              <span class="prompt" *ngIf="linha.tipo === 'cmd'">$ </span>{{ linha.texto }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tools-layout { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; align-items: start; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
    .field input, .field select { background: var(--bg-main); border: 1px solid var(--border-subtle); color: var(--text-main); padding: 11px 14px; border-radius: 8px; font-size: 14px; }
    .terminal-panel { padding: 0; overflow: hidden; background: #05070C; border-color: #1E2531; }
    .terminal-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #0B0F18; border-bottom: 1px solid #1E2531; }
    .term-dot { width: 11px; height: 11px; border-radius: 50%; }
    .term-dot.red { background: #EF4444; } .term-dot.yellow { background: #F59E0B; } .term-dot.green { background: #10B981; }
    .term-title { margin-left: 8px; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
    .terminal-body { padding: 20px; min-height: 420px; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.8; color: #A5B4FC; }
    .terminal-line.cmd { color: #F9FAFB; font-weight: 600; margin-top: 8px; }
    .terminal-line.result { color: #A5B4FC; white-space: pre-wrap; }
    .terminal-empty { color: var(--text-dim); font-style: italic; }
    .cursor-blink { display: inline-block; width: 8px; color: #10B981; animation: blink 1s step-end infinite; }
    @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
  `]
})
export class ToolsComponent {
  target = '';
  mode = 'ping';
  loading = false;
  historico: { texto: string, tipo: string }[] = [];

  constructor(private devices: DeviceService) {}

  executar() {
    this.loading = true;
    this.historico.push({ texto: this.mode + ' ' + this.target, tipo: 'cmd' });
    this.historico.push({ texto: 'Executando...', tipo: 'info' });

    const finalizar = (res: any, err: any) => {
      this.historico = this.historico.filter(h => h.texto !== 'Executando...');
      if (err) this.historico.push({ texto: 'Erro ao executar.', tipo: 'error' });
      else this.historico.push({ texto: res.message || res.log || 'Concluído.', tipo: 'result' });
      this.historico.push({ texto: '', tipo: 'result' });
      this.loading = false;
    };

    if (this.mode === 'ping') {
      this.devices.ping(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    } else if (this.mode === 'portscan') {
      this.devices.portscan(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    } else {
      this.devices.networkscan(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    }
  }
}