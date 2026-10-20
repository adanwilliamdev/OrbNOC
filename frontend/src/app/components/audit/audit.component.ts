import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolsService } from '../../services/tools.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div>
          <h1>Auditoria</h1>
          <p class="subtitle">Registro das ações feitas por usuários e pelo sistema.</p>
        </div>
        <button type="button" class="btn-outline" (click)="carregar()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>
          Atualizar
        </button>
      </div>

      <div class="panel table-panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Detalhe</th><th>Nível</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs">
                <td class="mono num">{{ log.timestamp | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="cell-title">{{ log.user }}</td>
                <td>{{ log.action }}</td>
                <td class="text-muted">{{ log.detail }}</td>
                <td>
                  <span class="badge" [ngClass]="(log.level || '') | lowercase">{{ nivel[log.level] || log.level }}</span>
                </td>
              </tr>
              <tr *ngIf="logs.length === 0">
                <td colspan="5">
                  <div class="empty">
                    <strong>Nenhum registro</strong>
                    <span>As ações do sistema aparecem aqui assim que acontecem.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AuditComponent implements OnInit {
  logs: any[] = [];
  readonly nivel: Record<string, string> = { INFO: 'Info', WARN: 'Aviso', ERROR: 'Erro' };
  constructor(private tools: ToolsService) {}
  ngOnInit() { this.carregar(); }
  carregar() { this.tools.audit().subscribe(l => this.logs = l); }
}
