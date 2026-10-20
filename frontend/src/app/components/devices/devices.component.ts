import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, Device } from '../../services/device.service';
import { AuthService } from '../../services/auth.service';
import { DiagnosticModalComponent } from '../shared/diagnostic-modal.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

type Filtro = 'ALL' | 'UP' | 'DOWN';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, FormsModule, DiagnosticModalComponent, ConfirmDialogComponent],
  template: `
    <div class="content">
      <div class="page-header">
        <div>
          <h1>Dispositivos</h1>
          <p class="subtitle">Cadastre, edite e diagnostique os ativos monitorados.</p>
        </div>
        <button type="button" class="btn-primary" (click)="abrirFormulario()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo dispositivo
        </button>
      </div>

      <div class="panel table-panel">
        <div class="toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="input" type="search" placeholder="Filtrar por nome, IP ou tag" aria-label="Filtrar dispositivos" [(ngModel)]="busca">
          </div>
          <div class="seg" role="group" aria-label="Filtrar por status">
            <button type="button" [class.on]="filtro === 'ALL'" (click)="filtro = 'ALL'">Todos <span class="count">{{ devices.length }}</span></button>
            <button type="button" [class.on]="filtro === 'UP'" (click)="filtro = 'UP'">Online <span class="count">{{ contar('UP') }}</span></button>
            <button type="button" [class.on]="filtro === 'DOWN'" (click)="filtro = 'DOWN'">Offline <span class="count">{{ contar('DOWN') }}</span></button>
          </div>
        </div>

        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Ativo</th><th>Endereço</th><th>Status</th><th class="right">Latência</th><th>Tags</th><th class="right">Ações</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of filtrados">
                <td>
                  <div class="cell-title">{{ d.hostname }}</div>
                  <div class="cell-sub">{{ tipoLabel(d.deviceType) }}<span *ngIf="d.location">, {{ d.location }}</span></div>
                </td>
                <td class="mono">{{ d.monitorUrl || d.ipAddress }}</td>
                <td>
                  <span class="pill" [class.up]="d.status === 'UP'" [class.down]="d.status !== 'UP'">{{ d.status === 'UP' ? 'Online' : 'Offline' }}</span>
                  <span *ngIf="d.maintenance" class="pill mute mute-gap" title="Alertas silenciados">Silenciado</span>
                </td>
                <td class="right mono num">{{ d.status === 'UP' && d.latency != null ? d.latency + ' ms' : '--' }}</td>
                <td>
                  <div class="chips" *ngIf="tagList(d).length > 0; else semTags">
                    <span class="chip" *ngFor="let t of tagList(d)">{{ t }}</span>
                  </div>
                  <ng-template #semTags><span class="text-muted">--</span></ng-template>
                </td>
                <td class="right">
                  <div class="actions-group">
                    <button type="button" class="btn-icon" title="Diagnosticar" [attr.aria-label]="'Diagnosticar ' + d.hostname" (click)="diagIp = d.ipAddress">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </button>
                    <button type="button" class="btn-icon" title="Editar" [attr.aria-label]="'Editar ' + d.hostname" (click)="editar(d)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                    </button>
                    <!-- RBAC: apenas ADMIN pode excluir -->
                    <button type="button" *ngIf="isAdmin" class="btn-icon danger" title="Excluir" [attr.aria-label]="'Excluir ' + d.hostname" (click)="alvoExclusao = d">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filtrados.length === 0">
                <td colspan="6">
                  <div class="empty">
                    <strong>{{ devices.length === 0 ? 'Nenhum dispositivo cadastrado' : 'Nenhum resultado' }}</strong>
                    <span>{{ devices.length === 0 ? 'Cadastre o primeiro ativo para começar a monitorar a rede.' : 'Ajuste a busca ou o filtro de status.' }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Formulário -->
    <div class="modal-overlay" *ngIf="exibirForm" (click)="exibirForm = false">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dev-title" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2 id="dev-title">{{ editando ? 'Editar dispositivo' : 'Novo dispositivo' }}</h2>
          <button type="button" class="btn-icon" aria-label="Fechar" (click)="exibirForm = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field">
              <label for="f-host">Hostname</label>
              <input id="f-host" class="input" type="text" placeholder="sw-core-01" [(ngModel)]="deviceAtual.hostname">
            </div>
            <div class="field">
              <label for="f-ip">Endereço IP</label>
              <input id="f-ip" class="input" type="text" placeholder="10.0.0.1" [(ngModel)]="deviceAtual.ipAddress">
            </div>
            <div class="field">
              <label for="f-type">Tipo</label>
              <select id="f-type" class="input" [(ngModel)]="deviceAtual.deviceType">
                <option value="SWITCH">Switch</option>
                <option value="ROUTER">Roteador</option>
                <option value="FIREWALL">Firewall</option>
                <option value="SERVER">Servidor</option>
              </select>
            </div>
            <div class="field">
              <label for="f-status">Status inicial</label>
              <select id="f-status" class="input" [(ngModel)]="deviceAtual.status">
                <option value="UP">Online</option>
                <option value="DOWN">Offline</option>
              </select>
            </div>
            <div class="field">
              <label for="f-loc">Localização</label>
              <input id="f-loc" class="input" type="text" placeholder="Rack 01" [(ngModel)]="deviceAtual.location">
            </div>
            <div class="field">
              <label for="f-tags">Tags</label>
              <input id="f-tags" class="input" type="text" placeholder="Datacenter A, Cliente X" [(ngModel)]="deviceAtual.tags">
              <span class="hint">Separe por vírgula.</span>
            </div>
            <div class="field span-2">
              <label for="f-url">URL de monitoramento HTTP (opcional)</label>
              <input id="f-url" class="input" type="text" placeholder="https://exemplo.com.br" [(ngModel)]="deviceAtual.monitorUrl">
              <span class="hint">Quando preenchida, o ativo é verificado por HTTP em vez de ping.</span>
            </div>
            <label class="check span-2">
              <input type="checkbox" [(ngModel)]="deviceAtual.maintenance">
              Modo manutenção: silenciar alertas deste dispositivo
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn-outline" (click)="exibirForm = false">Cancelar</button>
          <button type="button" class="btn-primary" (click)="salvar()" [disabled]="!deviceAtual.hostname || !deviceAtual.ipAddress">
            {{ editando ? 'Salvar alterações' : 'Cadastrar dispositivo' }}
          </button>
        </div>
      </div>
    </div>

    <app-diagnostic-modal *ngIf="diagIp" [ip]="diagIp" (closed)="diagIp = null"></app-diagnostic-modal>

    <app-confirm-dialog *ngIf="alvoExclusao"
      title="Excluir dispositivo"
      [message]="'Excluir ' + alvoExclusao.hostname + '? Ele deixa de ser monitorado e essa ação não pode ser desfeita.'"
      confirmLabel="Excluir dispositivo"
      (confirmed)="deletar()" (cancelled)="alvoExclusao = null"></app-confirm-dialog>
  `,
  styles: [`
    .mute-gap { margin-left: 6px; }
    td .chips { max-width: 260px; }
  `]
})
export class DevicesComponent implements OnInit {
  devices: Device[] = [];
  exibirForm = false;
  editando = false;
  deviceAtual: Device = this.novoDevice();
  isAdmin = false;

  busca = '';
  filtro: Filtro = 'ALL';
  diagIp: string | null = null;
  alvoExclusao: Device | null = null;

  private readonly tipos: Record<string, string> = { SWITCH: 'Switch', ROUTER: 'Roteador', FIREWALL: 'Firewall', SERVER: 'Servidor' };

  constructor(private service: DeviceService, private auth: AuthService) {
    const user = this.auth.getUser();
    this.isAdmin = user?.role === 'ADMIN' || user?.username === 'admin';
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.exibirForm = false; }

  ngOnInit() { this.carregar(); }
  carregar() { this.service.list().subscribe(d => this.devices = d); }

  get filtrados(): Device[] {
    const q = this.busca.trim().toLowerCase();
    return this.devices.filter(d => {
      if (this.filtro === 'UP' && d.status !== 'UP') return false;
      if (this.filtro === 'DOWN' && d.status === 'UP') return false;
      if (!q) return true;
      return [d.hostname, d.ipAddress, d.monitorUrl, d.tags, d.location]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }

  contar(status: 'UP' | 'DOWN'): number {
    return this.devices.filter(d => status === 'UP' ? d.status === 'UP' : d.status !== 'UP').length;
  }

  tipoLabel(t: string): string { return this.tipos[t] || t || 'Dispositivo'; }

  tagList(d: Device): string[] {
    return (d.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  }

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

  deletar() {
    const alvo = this.alvoExclusao;
    this.alvoExclusao = null;
    if (alvo?.id != null) this.service.delete(alvo.id).subscribe(() => this.carregar());
  }
}
