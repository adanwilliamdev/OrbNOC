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
        <div class="title-area">
          <h1>Logs de Auditoria</h1>
          <p class="subtitle">Rastreamento de ações do sistema</p>
        </div>
        <button class="btn-outline" (click)="carregar()">&#8635; Atualizar</button>
      </div>
      <div class="panel table-panel">
        <table>
          <thead><tr><th>Timestamp</th><th>Usuário</th><th>Ação</th><th>Detalhe</th><th>Nível</th></tr></thead>
          <tbody>
            <tr *ngFor="let log of logs">
              <td class="mono">{{ log.timestamp | date:'short' }}</td>
              <td><strong>{{ log.user }}</strong></td>
              <td>{{ log.action }}</td>
              <td class="text-muted">{{ log.detail }}</td>
              <td><span class="badge" [class.critical]="log.level === 'WARN'">{{ log.level }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class AuditComponent implements OnInit {
  logs: any[] = [];
  constructor(private tools: ToolsService) {}
  ngOnInit() { this.carregar(); }
  carregar() { this.tools.audit().subscribe(l => this.logs = l); }
}