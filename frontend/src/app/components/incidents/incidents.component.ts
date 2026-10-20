import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidentService, Incident } from '../../services/incident.service';

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div class="title-area">
          <h1>Incidentes</h1>
          <p class="subtitle">Registre, atualize e gerencie chamados e alertas do NOC.</p>
        </div>
        <button class="btn-primary" (click)="abrirFormulario()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Novo Incidente
        </button>
      </div>

      <div class="panel" *ngIf="exibirForm">
        <h2>{{ editando ? 'Editar' : 'Novo' }} Incidente</h2>
        <div class="form-grid">
          <input type="text" placeholder="Título (ex: Queda no Link Principal)" [(ngModel)]="incidentAtual.title">
          <input type="text" placeholder="Descrição detalhada" [(ngModel)]="incidentAtual.description">
          <select [(ngModel)]="incidentAtual.severity">
            <option value="CRITICAL">Crítico</option>
            <option value="HIGH">Alto</option>
            <option value="MEDIUM">Médio</option>
            <option value="LOW">Baixo</option>
          </select>
          <select [(ngModel)]="incidentAtual.status">
            <option value="OPEN">Aberto</option>
            <option value="IN_PROGRESS">Em Andamento</option>
            <option value="RESOLVED">Resolvido</option>
          </select>
        </div>
        <div style="margin-top: 16px; display:flex; gap:8px;">
          <button class="btn-primary" (click)="salvar()">Salvar</button>
          <button class="btn-outline" (click)="exibirForm = false">Cancelar</button>
        </div>
      </div>

      <div class="panel table-panel">
        <table>
          <thead>
            <tr><th>ID</th><th>Título</th><th>Severidade</th><th>Status</th><th style="text-align:right">Ações</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let i of incidents">
              <td><span class="mono">#{{ i.id }}</span></td>
              <td>
                <strong>{{ i.title }}</strong>
                <div class="sub-desc">{{ i.description }}</div>
              </td>
              <td>
                <span class="badge" [class.critical]="i.severity === 'CRITICAL'" [class.high]="i.severity === 'HIGH'">{{ i.severity }}</span>
              </td>
              <td>
                <span class="status-text" [class.resolved]="i.status === 'RESOLVED'">{{ i.status | titlecase }}</span>
              </td>
              <td style="text-align:right">
                <div class="actions-group">
                  <button class="btn-icon" title="Editar" (click)="editar(i)">&#9998;</button>
                  <button class="btn-icon danger" title="Excluir" (click)="deletar(i.id!)">&#128465;</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="incidents.length === 0">
              <td colspan="5">
                <div class="table-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 12 15 15 9"></polyline></svg>
                  <p>Tudo sob controle</p>
                  <span>Nenhum incidente ou alerta registrado nas últimas 24 horas.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class IncidentsComponent implements OnInit {
  incidents: Incident[] = [];
  exibirForm = false;
  editando = false;
  incidentAtual: Incident = this.novoIncident();

  constructor(private service: IncidentService) {}
  ngOnInit() { this.carregar(); }

  carregar() { this.service.list().subscribe(d => this.incidents = d); }
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

  deletar(id: number) {
    if (confirm('Excluir incidente #' + id + '?')) {
      this.service.delete(id).subscribe(() => this.carregar());
    }
  }
}