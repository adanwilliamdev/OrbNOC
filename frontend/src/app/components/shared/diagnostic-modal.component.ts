import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceService, DiagResult } from '../../services/device.service';

@Component({
  selector: 'app-diagnostic-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="diag-title" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <div>
            <h2 id="diag-title">Diagnóstico</h2>
            <div class="mono target">{{ ip }}</div>
          </div>
          <button type="button" class="btn-icon" aria-label="Fechar" (click)="closed.emit()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="actions">
            <button type="button" class="btn-primary" (click)="ping()" [disabled]="loading">Executar ping</button>
            <button type="button" class="btn-outline" (click)="traceroute()" [disabled]="loading">Executar traceroute</button>
          </div>
          <pre class="term-out" aria-live="polite"><span class="hint" *ngIf="!loading && !resultado && !erro">Escolha um teste para começar.</span><span class="hint" *ngIf="loading">Executando {{ comando }}…</span><span *ngIf="!loading && resultado">{{ resultado.message || resultado.log }}</span><span class="err" *ngIf="!loading && erro">Não foi possível executar o teste. Verifique se o backend está em execução.</span></pre>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .target { margin-top: 2px; color: var(--text-3); }
    .actions { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .hint { color: var(--text-3); }
    .err { color: var(--crit); }
  `]
})
export class DiagnosticModalComponent {
  @Input({ required: true }) ip = '';
  @Output() closed = new EventEmitter<void>();

  loading = false;
  erro = false;
  comando = '';
  resultado: DiagResult | null = null;

  constructor(private service: DeviceService) {}

  @HostListener('document:keydown.escape')
  onEscape() { this.closed.emit(); }

  ping() { this.executar('ping', this.service.ping(this.ip)); }
  traceroute() { this.executar('traceroute', this.service.traceroute(this.ip)); }

  private executar(nome: string, req: ReturnType<DeviceService['ping']>) {
    this.loading = true;
    this.erro = false;
    this.resultado = null;
    this.comando = nome;
    req.subscribe({
      next: res => { this.resultado = res; this.loading = false; },
      error: () => { this.erro = true; this.loading = false; }
    });
  }
}
