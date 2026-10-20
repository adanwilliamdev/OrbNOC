import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolsService } from '../../services/tools.service';
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
          <p class="subtitle">Ping, Traceroute, DNS e WHOIS — execute comandos em tempo real</p>
        </div>
      </div>

      <div class="tools-layout">
        <div class="panel form-panel">
          <h2>Consulta</h2>
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div class="field">
              <label>Host / IP / Domínio</label>
              <input type="text" placeholder="Ex: 8.8.8.8 ou google.com" [(ngModel)]="target">
            </div>
            <div class="field">
              <label>Comando</label>
              <select [(ngModel)]="mode">
                <option value="ping">Ping (ICMP)</option>
                <option value="traceroute">Traceroute</option>
                <option value="dns">Consulta DNS</option>
                <option value="whois">Consulta WHOIS</option>
              </select>
            </div>
            <button class="btn-primary" (click)="executar()" [disabled]="loading || !target">
              {{ loading ? 'Executando...' : '▶ Executar' }}
            </button>
            <button class="btn-outline" (click)="limparTerminal()" style="justify-content:center;">
              Limpar terminal
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
          <div class="terminal-body" #terminalBody>
            <div *ngIf="historico.length === 0" class="terminal-empty">
              Aguardando comando...
              <span class="cursor-blink">_</span>
            </div>
            <div *ngFor="let linha of historico; let i = index" class="terminal-line" [ngClass]="linha.tipo">
              <span class="prompt" *ngIf="linha.tipo === 'cmd'">$ </span>{{ linha.texto }}
              <span *ngIf="i === historico.length - 1 && !loading" class="cursor-blink">_</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tools-layout { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; align-items: start; }
    @media (max-width: 900px) { .tools-layout { grid-template-columns: 1fr; } }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.03em; text-transform: uppercase; }
    .field input, .field select {
      background: var(--bg-main); border: 1px solid var(--border-subtle);
      color: var(--text-main); padding: 11px 14px; border-radius: 8px;
      font-size: 14px; font-family: inherit; outline: none; transition: all 0.2s;
    }
    .field input:focus, .field select:focus { border-color: var(--brand-accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }

    .terminal-panel { padding: 0; overflow: hidden; background: #05070C; border-color: #1E2531; }
    .terminal-header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px; background: #0B0F18; border-bottom: 1px solid #1E2531;
    }
    .term-dot { width: 11px; height: 11px; border-radius: 50%; }
    .term-dot.red { background: #EF4444; }
    .term-dot.yellow { background: #F59E0B; }
    .term-dot.green { background: #10B981; }
    .term-title { margin-left: 8px; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }

    .terminal-body {
      padding: 20px; min-height: 420px; max-height: 560px; overflow-y: auto;
      font-family: var(--font-mono); font-size: 12.5px; line-height: 1.8; color: #A5B4FC;
    }
    .terminal-body::-webkit-scrollbar { width: 6px; }
    .terminal-body::-webkit-scrollbar-track { background: transparent; }
    .terminal-body::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 3px; }
    .terminal-body::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }

    .terminal-line { white-space: pre-wrap; word-break: break-word; }
    .terminal-line.cmd { color: #F9FAFB; font-weight: 600; margin-top: 8px; }
    .terminal-line.result { color: #A5B4FC; }
    .terminal-line.error { color: #FCA5A5; }
    .terminal-line.info { color: #6EE7B7; }
    .prompt { color: #10B981; user-select: none; margin-right: 2px; }
    .terminal-empty { color: var(--text-dim); font-style: italic; }

    .cursor-blink {
      display: inline-block; width: 8px; margin-left: 2px;
      color: #10B981; animation: blink 1s step-end infinite;
    }
    @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
  `]
})
export class ToolsComponent {
  target = '';
  mode = 'ping';
  loading = false;
  historico: { texto: string, tipo: string }[] = [];

  constructor(private tools: ToolsService, private devices: DeviceService) {}

  executar() {
    if (!this.target) return;
    this.loading = true;
    this.historico.push({ texto: this.mode + ' ' + this.target, tipo: 'cmd' });
    this.historico.push({ texto: 'Executando comando...', tipo: 'info' });

    const finalizar = (res: any, err: any) => {
      const idx = this.historico.findIndex(h => h.texto === 'Executando comando...');
      if (idx >= 0) this.historico.splice(idx, 1);
      if (err) {
        this.historico.push({ texto: 'Erro ao executar o comando. Verifique a conexao com o backend.', tipo: 'error' });
      } else {
        const output = res.message || res.log || JSON.stringify(res, null, 2);
        this.historico.push({ texto: output, tipo: 'result' });
      }
      this.historico.push({ texto: '', tipo: 'result' });
      this.loading = false;
      setTimeout(() => {
        const el = document.querySelector('.terminal-body');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    };

    if (this.mode === 'dns') {
      this.tools.dns(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    } else if (this.mode === 'whois') {
      this.tools.whois(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    } else if (this.mode === 'ping') {
      this.devices.ping(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    } else {
      this.devices.traceroute(this.target).subscribe(r => finalizar(r, null), e => finalizar(null, e));
    }
  }

  limparTerminal() { this.historico = []; }
}