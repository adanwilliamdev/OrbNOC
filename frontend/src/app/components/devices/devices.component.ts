import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, Device } from '../../services/device.service';
import { AuthService } from '../../services/auth.service';

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
            <option value="UP">Online</option>
            <option value="DOWN">Offline</option>
          </select>
          <input type="text" placeholder="Localização (Rack 01)" [(ngModel)]="deviceAtual.location">
          <input type="text" placeholder="Tags (ex: Datacenter A, Cliente X)" [(ngModel)]="deviceAtual.tags">
          <input type="text" placeholder="URL para monitoramento HTTP (ex: https://google.com)" [(ngModel)]="deviceAtual.monitorUrl">
          <label style="display:flex; align-items:center; gap:8px; color:var(--text-main);">
            <input type="checkbox" [(ngModel)]="deviceAtual.maintenance" style="width:auto;"> Modo Manutenção (Mute de alertas)
          </label>
        </div>
        <div style="margin-top: 16px; display:flex; gap:8px;">
          <button class="btn-primary" (click)="salvar()">Salvar</button>
          <button class="btn-outline" (click)="exibirForm = false">Cancelar</button>
        </div>
      </div>

      <div class="panel table-panel">
        <table>
          <thead>
            <tr><th>Hostname</th><th>IP / URL</th><th>Status</th><th>Tags</th><th style="text-align:right">Ações</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of devices">
              <td><strong>{{ d.hostname }}</strong> <br><small class="text-muted">{{ d.location }}</small></td>
              <td class="mono">{{ d.monitorUrl || d.ipAddress }}</td>
              <td>
                <span class="badge-status" [class.up]="d.status === 'UP'" [class.down]="d.status !== 'UP'">
                  {{ d.status }}
                </span>
                <span *ngIf="d.maintenance" class="badge" style="background:#374151; margin-left:4px;">MUTE</span>
              </td>
              <td><small class="text-muted">{{ d.tags || '--' }}</small></td>
              <td style="text-align:right">
                <div class="actions-group">
                  <button class="btn-icon" title="Diagnóstico" (click)="abrirDiagnostico(d.ipAddress)">&#9889;</button>
                  <button class="btn-icon" title="Editar" (click)="editar(d)">&#9998;</button>
                  <!-- RBAC: Apenas ADMIN pode deletar -->
                  <button *ngIf="isAdmin" class="btn-icon danger" title="Excluir" (click)="deletar(d.id!)">&#128465;</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class DevicesComponent implements OnInit {
  devices: Device[] = [];
  exibirForm = false;
  editando = false;
  deviceAtual: Device = this.novoDevice();
  isAdmin = false;

  constructor(private service: DeviceService, private auth: AuthService) {
    const user = this.auth.getUser();
    this.isAdmin = user?.role === 'ADMIN' || user?.username === 'admin';
  }

  ngOnInit() { this.carregar(); }
  carregar() { this.service.list().subscribe(d => this.devices = d); }
  novoDevice(): Device { return { hostname: '', ipAddress: '', deviceType: 'SWITCH', status: 'UP', location: '', maintenance: false }; }
  abrirFormulario() { this.deviceAtual = this.novoDevice(); this.editando = false; this.exibirForm = true; }
  editar(d: Device) { this.deviceAtual = { ...d }; this.editando = true; this.exibirForm = true; }

  salvar() {
    if (this.editando && this.deviceAtual.id) {
      this.service.update(this.deviceAtual.id, this.deviceAtual).subscribe(() => { this.carregar(); this.exibirForm = false; });
    } else {
      this.service.create(this.deviceAtual).subscribe(() => { this.carregar(); this.exibirForm = false; });
    }
  }
  deletar(id: number) { if(confirm('Excluir?')) this.service.delete(id).subscribe(() => this.carregar()); }
  abrirDiagnostico(ip: string) { /* Mantido igual */ }
}