import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidentService, Incident } from '../../services/incident.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

type Filtro = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <div class="content">
      <div class="page-header">
        <div>
          <h1>Incidentes</h1>
          <p class="subtitle">Registre, acompanhe e resolva ocorrências do NOC.</p>
        </div>
        <button type="button" class="btn-primary" (click)="abrirFormulario()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo incidente
        </button>
      </div>

      <div class="panel table-panel">
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Filtrar por status">
            <button type="button" [class.on]="filtro === 'ALL'" (click)="filtro = 'ALL'">Todos <span class="count">{{ incidents.length }}</span></button>
            <button type="button" [class.on]="filtro === 'OPEN'" (click)="filtro = 'OPEN'">Abertos <span class="count">{{ contar('OPEN') }}</span></button>
            <button type="button" [class.on]="filtro === 'IN_PROGRESS'" (click)="filtro = 'IN_PROGRESS'">Em andamento <span class="count">{{ contar('IN_PROGRESS') }}</span></button>
            <button type="button" [class.on]="filtro === 'RESOLVED'" (click)="filtro = 'RESOLVED'">Resolvidos <span class="count">{{ contar('RESOLVED') }}</span></button>
          </div>
        </div>

        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Nº</th><th>Incidente</th><th>Severidade</th><th>Status</th><th>Aberto em</th><th class="right">Ações</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let i of filtrados">
                <td class="mono">#{{ i.id }}</td>
                <td class="col-title">
                  <div class="cell-title">{{ i.title }}</div>
                  <div class="cell-sub clamp">{{ i.description }}</div>
                </td>
                <td><span class="badge" [ngClass]="i.severity | lowercase">{{ sevLabel[i.severity] || i.severity }}</span></td>
                <td><span class="pill" [ngClass]="statusClass(i.status)">{{ statusLabel[i.status] || i.status }}</span></td>
                <td class="mono num">{{ i.createdAt ? (i.createdAt | date:'dd/MM/yyyy HH:mm') : '--' }}</td>
                <td class="right">
                  <div class="actions-group">
                    <button type="button" class="btn-icon" title="Editar" [attr.aria-label]="'Editar incidente ' + i.id" (click)="editar(i)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                    </button>
                    <button type="button" class="btn-icon danger" title="Excluir" [attr.aria-label]="'Excluir incidente ' + i.id" (click)="alvoExclusao = i">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filtrados.length === 0">
                <td colspan="6">
                  <div class="empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 12 15 15 9"/></svg>
                    <strong>{{ incidents.length === 0 ? 'Nenhum incidente registrado' : 'Nenhum incidente neste filtro' }}</strong>
                    <span>{{ incidents.length === 0 ? 'Use “Novo incidente” quando algo sair do esperado.' : 'Escolha outro status para ver mais resultados.' }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal-overlay" *ngIf="exibirForm" (click)="exibirForm = false">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="inc-title" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2 id="inc-title">{{ editando ? 'Editar incidente' : 'Novo incidente' }}</h2>
          <button type="button" class="btn-icon" aria-label="Fechar" (click)="exibirForm = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field span-2">
              <label for="i-title">Título</label>
              <input id="i-title" class="input" type="text" placeholder="Queda no link principal" [(ngModel)]="incidentAtual.title">
            </div>
            <div class="field span-2">
              <label for="i-desc">Descrição</label>
              <textarea id="i-desc" class="input" placeholder="O que aconteceu, qual o impacto e o que já foi tentado" [(ngModel)]="incidentAtual.description"></textarea>
            </div>
            <div class="field">
              <label for="i-sev">Severidade</label>
              <select id="i-sev" class="input" [(ngModel)]="incidentAtual.severity">
                <option value="CRITICAL">Crítico</option>
                <option value="HIGH">Alto</option>
                <option value="MEDIUM">Médio</option>
                <option value="LOW">Baixo</option>
              </select>
            </div>
            <div class="field">
              <label for="i-status">Status</label>
              <select id="i-status" class="input" [(ngModel)]="incidentAtual.status">
                <option value="OPEN">Aberto</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="RESOLVED">Resolvido</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn-outline" (click)="exibirForm = false">Cancelar</button>
          <button type="button" class="btn-primary" (click)="salvar()" [disabled]="!incidentAtual.title">
            {{ editando ? 'Salvar alterações' : 'Registrar incidente' }}
          </button>
        </div>
      </div>
    </div>

    <app-confirm-dialog *ngIf="alvoExclusao"
      title="Excluir incidente"
      [message]="'Excluir o incidente #' + alvoExclusao.id + ' (' + alvoExclusao.title + ')? Essa ação não pode ser desfeita.'"
      confirmLabel="Excluir incidente"
      (confirmed)="deletar()" (cancelled)="alvoExclusao = null"></app-confirm-dialog>
  `,
  styles: [`
    .col-title { max-width: 420px; }
    .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  `]
})
export class IncidentsComponent implements OnInit {
  incidents: Incident[] = [];
  exibirForm = false;
  editando = false;
  incidentAtual: Incident = this.novoIncident();
  filtro: Filtro = 'ALL';
  alvoExclusao: Incident | null = null;

  readonly sevLabel: Record<string, string> = { CRITICAL: 'Crítico', HIGH: 'Alto', MEDIUM: 'Médio', LOW: 'Baixo' };
  readonly statusLabel: Record<string, string> = { OPEN: 'Aberto', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvido' };

  constructor(private service: IncidentService) {}

  @HostListener('document:keydown.escape')
  onEscape() { this.exibirForm = false; }

  ngOnInit() { this.carregar(); }
  carregar() { this.service.list().subscribe(d => this.incidents = d); }

  get filtrados(): Incident[] {
    return this.filtro === 'ALL' ? this.incidents : this.incidents.filter(i => i.status === this.filtro);
  }

  contar(status: string): number { return this.incidents.filter(i => i.status === status).length; }

  statusClass(status: string): string {
    return status === 'RESOLVED' ? 'resolved' : status === 'IN_PROGRESS' ? 'progress' : 'open';
  }

  novoIncident(): Incident { return { title: '', description: '', severity: 'MEDIUM', status: 'OPEN' }; }
  abrirFormulario() { this.incidentAtual = this.novoIncident(); this.editando = false; this.exibirForm = true; }
  editar(i: Incident) { this.incidentAtual = { ...i }; this.editando = true; this.exibirForm = true; }

  salvar() {
    if (this.editando && this.incidentAtual.id) {
      this.service.update(this.incidentAtual.id, this.incidentAtual).subscribe(() => { this.carregar(); this.exibirForm = false; });
    } else {
      this.service.create(this.incidentAtual).subscribe(() => { this.carregar(); this.exibirForm = false; });
    }
  }

  deletar() {
    const alvo = this.alvoExclusao;
    this.alvoExclusao = null;
    if (alvo?.id != null) this.service.delete(alvo.id).subscribe(() => this.carregar());
  }
}
