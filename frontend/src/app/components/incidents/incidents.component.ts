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
          <h1>Gerenciar Incidentes</h1>
          <p class="subtitle">Registre, atualize e resolva chamados do NOC.</p>
        </div>
        <button class="btn-primary" (click)="abrirFormulario()">+ Novo Incidente</button>
      </div>

      <div class="panel" *ngIf="exibirForm">
        <h2>{{ editando ? 'Editar' : 'Novo' }} Incidente</h2>
        <div class="form-grid">
          <input type="text" placeholder="Titulo" [(ngModel)]="incidentAtual.title">
          <input type="text" placeholder="Descricao" [(ngModel)]="incidentAtual.description">
          <select [(ngModel)]="incidentAtual.severity">
            <option value="CRITICAL">Critico</option>
            <option value="HIGH">Alto</option>
            <option value="MEDIUM">Medio</option>
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

      <div class="panel">
        <table>
          <thead>
            <tr><th>ID</th><th>Titulo</th><th>Severidade</th><th>Status</th><th>Acoes</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let i of incidents">
              <td>{{ i.id }}</td>
              <td>{{ i.title }}</td>
              <td><span class="badge" [class.critical]="i.severity === 'CRITICAL'">{{ i.severity }}</span></td>
              <td>{{ i.status }}</td>
              <td>
                <button class="btn-icon" (click)="editar(i)">&#9998;</button>
                <button class="btn-icon danger" (click)="deletar(i.id!)">&#128465;</button>
              </td>
            </tr>
            <tr *ngIf="incidents.length === 0">
              <td colspan="5" class="vazio">Nenhum incidente registrado ainda.</td>
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