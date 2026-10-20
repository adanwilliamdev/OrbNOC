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
          <h1>Gerenciar Dispositivos</h1>
          <p class="subtitle">Adicione, edite ou remova ativos de rede.</p>
        </div>
        <button class="btn-primary" (click)="abrirFormulario()">+ Novo Dispositivo</button>
      </div>

      <div class="panel" *ngIf="exibirForm">
        <h2>{{ editando ? 'Editar' : 'Novo' }} Dispositivo</h2>
        <div class="form-grid">
          <input type="text" placeholder="Hostname" [(ngModel)]="deviceAtual.hostname">
          <input type="text" placeholder="IP" [(ngModel)]="deviceAtual.ipAddress">
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
          <input type="text" placeholder="Localizacao" [(ngModel)]="deviceAtual.location">
        </div>
        <div style="margin-top: 16px; display:flex; gap:8px;">
          <button class="btn-primary" (click)="salvar()">Salvar</button>
          <button class="btn-outline" (click)="exibirForm = false">Cancelar</button>
        </div>
      </div>

      <div class="panel">
        <table>
          <thead>
            <tr><th>Hostname</th><th>IP</th><th>Tipo</th><th>Status</th><th>Local</th><th>Acoes</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of devices">
              <td>{{ d.hostname }}</td>
              <td>{{ d.ipAddress }}</td>
              <td>{{ d.deviceType }}</td>
              <td><span class="badge" [class.critical]="d.status === 'DOWN'">{{ d.status }}</span></td>
              <td>{{ d.location }}</td>
              <td>
                <button class="btn-icon" title="Diagnostico" (click)="abrirDiagnostico(d.ipAddress)">&#9889;</button>
                <button class="btn-icon" title="Editar" (click)="editar(d)">&#9998;</button>
                <button class="btn-icon danger" title="Excluir" (click)="deletar(d.id!)">&#128465;</button>
              </td>
            </tr>
            <tr *ngIf="devices.length === 0">
              <td colspan="6" class="vazio">Nenhum dispositivo cadastrado ainda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-overlay" *ngIf="diagModalAberto">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Diagnostico: {{ diagIpAtual }}</h2>
          <button class="btn-icon" (click)="fecharDiagnostico()">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="diag-actions">
            <button class="btn-primary" (click)="rodarPing()" [disabled]="diagLoading">Rodar Ping</button>
            <button class="btn-outline" (click)="rodarTraceroute()" [disabled]="diagLoading">Rodar Traceroute</button>
          </div>
          <div class="diag-log" *ngIf="diagLoading"><p class="loading">Executando...</p></div>
          <div class="diag-log" *ngIf="diagResultado && !diagLoading">
            <pre>{{ diagResultado.message || diagResultado.log }}</pre>
          </div>
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
    this.diagIpAtual = ip;
    this.diagModalAberto = true;
    this.diagResultado = null;
    this.diagLoading = false;
  }
  fecharDiagnostico() { this.diagModalAberto = false; }
  rodarPing() {
    this.diagLoading = true;
    this.service.ping(this.diagIpAtual).subscribe(res => { this.diagResultado = res; this.diagLoading = false; });
  }
  rodarTraceroute() {
    this.diagLoading = true;
    this.service.traceroute(this.diagIpAtual).subscribe(res => { this.diagResultado = res; this.diagLoading = false; });
  }
}