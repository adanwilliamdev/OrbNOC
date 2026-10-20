import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../../services/device.service';
import { ToolsService } from '../../services/tools.service';
import { Observable } from 'rxjs';

type Mode = 'ping' | 'traceroute' | 'dns' | 'portscan' | 'networkscan';
interface ToolDef { id: Mode; nome: string; desc: string; placeholder: string; campo: string; }
interface Linha { texto: string; tipo: 'cmd' | 'info' | 'result' | 'error' | 'meta'; }

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div>
          <h1>Ferramentas de diagnóstico</h1>
          <p class="subtitle">Execute testes de rede direto do servidor do OrbNOC. Use apenas em redes que você está autorizado a testar.</p>
        </div>
      </div>

      <div class="tools-layout">
        <div class="panel form-panel">
          <div class="panel-head"><h2>Teste</h2></div>

          <div class="tool-list" role="radiogroup" aria-label="Tipo de teste">
            <button type="button" class="tool" role="radio" *ngFor="let t of ferramentas"
                    [class.on]="mode === t.id" [attr.aria-checked]="mode === t.id" (click)="mode = t.id">
              <span class="tool-name">{{ t.nome }}</span>
              <span class="tool-desc">{{ t.desc }}</span>
            </button>
          </div>

          <div class="field alvo">
            <label for="t-target">{{ atual.campo }}</label>
            <input id="t-target" class="input mono-input" type="text" [placeholder]="atual.placeholder"
                   [(ngModel)]="target" (keydown.enter)="executar()" autocomplete="off" spellcheck="false">
          </div>
          <button type="button" class="btn-primary run" (click)="executar()" [disabled]="loading || !target.trim()">
            <svg *ngIf="!loading" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20"/></svg>
            {{ loading ? 'Executando…' : 'Executar ' + atual.nome.toLowerCase() }}
          </button>
        </div>

        <div class="terminal" aria-label="Saída dos testes">
          <div class="terminal-head">
            <span class="term-title">orbnoc&#64;diagnostico</span>
            <button type="button" class="btn-outline btn-sm" (click)="limpar()" [disabled]="historico.length === 0">Limpar</button>
          </div>
          <div class="terminal-body" aria-live="polite">
            <div *ngIf="historico.length === 0" class="terminal-empty">
              Escolha um teste, informe o alvo e execute. A saída aparece aqui.<span class="cursor">_</span>
            </div>
            <div *ngFor="let linha of historico" class="line" [ngClass]="linha.tipo">
              <span class="prompt" *ngIf="linha.tipo === 'cmd'">$ </span>{{ linha.texto }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tools-layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 20px; align-items: start; }
    .form-panel { margin: 0; }
    .tool-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
    .tool {
      display: flex; flex-direction: column; gap: 1px; padding: 9px 12px; text-align: left;
      background: transparent; border: 1px solid var(--line); border-radius: var(--r-sm); transition: border-color .15s, background .15s;
    }
    .tool:hover { background: var(--surface-2); }
    .tool.on { border-color: var(--brand); background: var(--brand-wash); }
    .tool-name { font-size: 13.5px; font-weight: 500; }
    .tool-desc { font-size: 12.5px; color: var(--text-3); }
    .alvo { margin-bottom: 14px; }
    .mono-input { font-family: var(--font-mono); font-size: 13px; }
    .run { width: 100%; height: 38px; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12.5px; }

    .terminal { background: #070B10; border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
    .terminal-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 8px 16px; background: var(--surface); border-bottom: 1px solid var(--line); }
    .term-title { font-family: var(--font-mono); font-size: 12px; color: var(--text-3); }
    .terminal-body { padding: 18px 20px; min-height: 440px; max-height: 70vh; overflow: auto; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.75; color: #B7C4D4; }
    .line { white-space: pre-wrap; word-break: break-word; }
    .line.cmd { color: var(--text); font-weight: 500; margin-top: 10px; }
    .line.cmd:first-child { margin-top: 0; }
    .line.info { color: var(--text-3); }
    .line.error { color: var(--crit); }
    .prompt { color: var(--brand); user-select: none; }
    .terminal-empty { color: var(--text-3); }
    .cursor { display: inline-block; margin-left: 2px; color: var(--brand); animation: blink 1s step-end infinite; }

    @media (max-width: 1000px) { .tools-layout { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class ToolsComponent {
  target = '';
  mode: Mode = 'ping';
  loading = false;
  historico: Linha[] = [];

  readonly ferramentas: ToolDef[] = [
    { id: 'ping', nome: 'Ping', desc: 'Testa se o host responde e mede o tempo.', placeholder: '8.8.8.8', campo: 'Host ou IP' },
    { id: 'traceroute', nome: 'Traceroute', desc: 'Mostra os saltos até o destino.', placeholder: '8.8.8.8', campo: 'Host ou IP' },
    { id: 'dns', nome: 'DNS', desc: 'Resolve um nome para endereços IP.', placeholder: 'exemplo.com.br', campo: 'Nome do host' },
    { id: 'portscan', nome: 'Port scanner', desc: 'Verifica as portas comuns de um host.', placeholder: '192.168.1.10', campo: 'Host ou IP' },
    { id: 'networkscan', nome: 'Descoberta de rede', desc: 'Varre a sub-rede /24 atrás de hosts ativos.', placeholder: '192.168.1', campo: 'Sub-rede (3 primeiros octetos)' },
  ];

  constructor(private devices: DeviceService, private tools: ToolsService) {}

  get atual(): ToolDef { return this.ferramentas.find(f => f.id === this.mode)!; }

  limpar() { this.historico = []; }

  executar() {
    const alvo = this.target.trim();
    if (!alvo || this.loading) return;

    this.loading = true;
    this.historico.push({ texto: `${this.mode} ${alvo}`, tipo: 'cmd' });
    this.historico.push({ texto: 'Executando…', tipo: 'info' });

    const finalizar = (res: any, err: any) => {
      this.historico = this.historico.filter(h => h.tipo !== 'info');
      if (err) this.historico.push({ texto: 'Erro ao executar. Verifique se o backend está em execução.', tipo: 'error' });
      else this.historico.push({ texto: res.message || res.log || 'Concluído.', tipo: 'result' });
      this.loading = false;
    };

    let req: Observable<any>;
    switch (this.mode) {
      case 'ping': req = this.devices.ping(alvo); break;
      case 'traceroute': req = this.devices.traceroute(alvo); break;
      case 'dns': req = this.tools.dns(alvo); break;
      case 'portscan': req = this.devices.portscan(alvo); break;
      default: req = this.devices.networkscan(alvo);
    }
    req.subscribe({ next: r => finalizar(r, null), error: e => finalizar(null, e) });
  }
}
