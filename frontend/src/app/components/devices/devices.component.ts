import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, Device, DiagResult } from '../../services/device.service';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div class="title-area">
          <h1>Dispositivos</h1>
          <p class="subtitle">Gerenciamento e diagnóstico de ativos de rede.</p>
        </div>
        <button class="btn-primary" (click)="abrirFormulario()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Novo Dispositivo
        </button>
      </div>

      <div class="panel" *ngIf="exibirForm">
        <h2>{{ editando ? 'Editar' : 'Novo' }} Dispositivo</h2>
        <div class="form-grid">
          <input type="text" placeholder="Hostname (ex: core-sw-01)" [(ngModel)]="deviceAtual.hostname">
          <input type="text" placeholder="Endereço IP" [(ngModel)]="deviceAtual.ipAddress">
          <select [(ngModel)]="deviceAtual.deviceType">
            <option value="SWITCH">Switch</option>
            <option value="ROUTER">Roteador</option>
            <option value="FIREWALL">Firewall</option>
            <option value="SERVER">Servidor</option>
          </select>
          <select [(ngModel)]="deviceAtual.status">
            <option value="UP">Online (UP)</option>
            <option value="DOWN">Offline (DOWN)</option>
            <option value="DEGRADED">Degradado</option>
          </select>
          <input type="text" placeholder="Localização (ex: Matriz, Filial SP)" [(ngModel)]="deviceAtual.location">
        </div>
        <div style="margin-top: 16px; display:flex; gap:8px;">
          <button class="btn-primary" (click)="salvar()">Salvar</button>
          <button class="btn-outline" (click)="exibirForm = false">Cancelar</button>
        </div>
      </div>

      <div class="panel table-panel">
        <table>
          <thead>
            <tr><th>Hostname</th><th>IP</th><th>Tipo</th><th>Status</th><th>Localização</th><th style="text-align:right">Ações</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of devices">
              <td><strong>{{ d.hostname }}</strong></td>
              <td class="mono">{{ d.ipAddress }}</td>
              <td><span class="text-muted">{{ d.deviceType | titlecase }}</span></td>
              <td>
                <span class="badge-status" [class.up]="d.status === 'UP'" [class.down]="d.status !== 'UP'">
                  <span class="badge-dot"></span>
                  {{ d.status }}
                </span>
              </td>
              <td>
                <span *ngIf="d.location; else semLocal">{{ d.location }}</span>
                <ng-template #semLocal><span class="text-muted" style="font-style: italic; opacity: 0.5;">--</span></ng-template>
              </td>
              <td style="text-align:right">
                <div class="actions-group">
                  <button class="btn-icon" title="Diagnóstico" (click)="abrirDiagnostico(d.ipAddress)">&#9889;</button>
                  <button class="btn-icon" title="Editar" (click)="editar(d)">&#9998;</button>
                  <button class="btn-icon danger" title="Excluir" (click)="deletar(d.id!)">&#128465;</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="devices.length === 0">
              <td colspan="6">
                <div class="table-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                  <p>Nenhum dispositivo cadastrado</p>
                  <span>Adicione seu primeiro ativo de rede para começar o monitoramento.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" *ngIf="diagModalAberto">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Diagnóstico: {{ diagIpAtual }}</h2>
          <button class="btn-outline" style="padding: 4px 8px;" (click)="fecharDiagnostico()">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="diag-actions">
            <button class="btn-primary" (click)="rodarPing()" [disabled]="diagLoading">Rodar Ping</button>
            <button class="btn-outline" (click)="rodarTraceroute()" [disabled]="diagLoading">Rodar Traceroute</button>
          </div>
          <div class="diag-log" *ngIf="diagLoading"><p style="color:#9CA3AF;font-style:italic;">Executando...</p></div>
          <div class="diag-log" *ngIf="diagResultado && !diagLoading"><pre>{{ diagResultado.message || diagResultado.log }}</pre></div>
        </div>
      </div>
    </div>
  `
})
export class DevicesComponent implements OnInit {
  devices: Device[] = [];
  exibirForm = false;
  editando = false;
  deviceAtual: Device = this.novoDevice();
  
  diagModalAberto = false;
  diagLoading = false;
  diagResultado: DiagResult | null = null;
  diagIpAtual = '';

  constructor(private service: DeviceService) {}
  ngOnInit() { this.carregar(); }

  carregar() { this.service.list().subscribe(d => this.devices = d); }
  novoDevice(): Device { return { hostname: '', ipAddress: '', deviceType: 'SWITCH', status: 'UP', location: '' }; }

  abrirFormulario() { this.deviceAtual = this.novoDevice(); this.editando = false; this.exibirForm = true; }
  editar(d: Device) { this.deviceAtual = { ...d }; this.editando = true; this.exibirForm = true; }

  salvar() {
    if (this.editando && this.deviceAtual.id) {
      this.service.update(this.deviceAtual.id, this.deviceAtual).subscribe(() => { this.carregar(); this.exibirForm = false; });
    } else {
      this.service.create(this.deviceAtual).subscribe(() => { this.carregar(); this.exibirForm = false; });
    }
  }

  deletar(id: number) {
    if (confirm('Excluir dispositivo #' + id + '?')) {
      this.service.delete(id).subscribe(() => this.carregar());
    }
  }

  abrirDiagnostico(ip: string) {
    this.diagIpAtual = ip; this.diagModalAberto = true;
    this.diagResultado = null; this.diagLoading = false;
  }
  fecharDiagnostico() { this.diagModalAberto = false; }
  rodarPing() {
    this.diagLoading = true;
    this.service.ping(this.diagIpAtual).subscribe({ 
      next: (res) => { this.diagResultado = res; this.diagLoading = false; }, 
      error: () => { this.diagLoading = false; } 
    });
  }
  rodarTraceroute() {
    this.diagLoading = true;
    this.service.traceroute(this.diagIpAtual).subscribe({ 
      next: (res) => { this.diagResultado = res; this.diagLoading = false; }, 
      error: () => { this.diagLoading = false; } 
    });
  }
}