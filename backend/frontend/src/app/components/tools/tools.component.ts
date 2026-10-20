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
          <p class="subtitle">Ping, Traceroute, DNS e WHOIS — tudo pelo navegador</p>
        </div>
      </div>

      <div class="panel">
        <h2>Consulta Integrada</h2>
        <div class="form-grid" style="grid-template-columns: 2fr 1fr;">
          <input type="text" placeholder="Hostname, IP ou domínio (ex: 8.8.8.8 ou google.com)" [(ngModel)]="target">
          <select [(ngModel)]="mode">
            <option value="ping">Ping (ICMP)</option>
            <option value="traceroute">Traceroute</option>
            <option value="dns">Consulta DNS</option>
            <option value="whois">Consulta WHOIS</option>
          </select>
        </div>
        <button class="btn-primary" (click)="executar()" [disabled]="loading">
          {{ loading ? 'Executando...' : 'Executar' }}
        </button>

        <div class="diag-log" *ngIf="resultado" style="margin-top:24px;">
          <pre>{{ resultado }}</pre>
        </div>
      </div>
    </div>
  `
})
export class ToolsComponent {
  target = '';
  mode = 'ping';
  loading = false;
  resultado = '';

  constructor(private tools: ToolsService, private devices: DeviceService) {}

  executar() {
    if (!this.target) return;
    this.loading = true;
    this.resultado = '';

    if (this.mode === 'dns') {
      this.tools.dns(this.target).subscribe(r => {
        this.resultado = r.message; this.loading = false;
      }, () => this.loading = false);
    } else if (this.mode === 'whois') {
      this.tools.whois(this.target).subscribe(r => {
        this.resultado = r.message; this.loading = false;
      }, () => this.loading = false);
    } else if (this.mode === 'ping') {
      this.devices.ping(this.target).subscribe(r => {
        this.resultado = r.message || ''; this.loading = false;
      }, () => this.loading = false);
    } else {
      this.devices.traceroute(this.target).subscribe(r => {
        this.resultado = r.log || ''; this.loading = false;
      }, () => this.loading = false);
    }
  }
}