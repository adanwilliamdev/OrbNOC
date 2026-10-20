import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolsService } from '../../services/tools.service';

@Component({
  selector: 'app-topology',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div class="title-area">
          <h1>Topologia de Rede</h1>
          <p class="subtitle">Mapa visual da infraestrutura</p>
        </div>
        <button class="btn-outline" (click)="carregar()">&#8635; Atualizar</button>
      </div>
      <div class="panel" style="overflow:auto;">
        <svg viewBox="0 0 800 600" style="width:100%; height:600px; display:block;">
          <line *ngFor="let l of links"
                [attr.x1]="getNode(l.source).x" [attr.y1]="getNode(l.source).y"
                [attr.x2]="getNode(l.target).x" [attr.y2]="getNode(l.target).y"
                stroke="rgba(251,191,36,0.25)" stroke-width="2" stroke-dasharray="4 4"/>
          <g *ngFor="let n of nodes" [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
            <circle r="40" [attr.fill]="n.status === 'UP' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'"/>
            <rect x="-28" y="-20" width="56" height="40" rx="8"
                  [attr.fill]="n.type === 'CORE' ? '#FBBF24' : '#111827'"
                  [attr.stroke]="n.type === 'CORE' ? '#F59E0B' : (n.status === 'UP' ? '#10B981' : '#EF4444')"
                  stroke-width="2"/>
            <text y="4" text-anchor="middle"
                  [attr.fill]="n.type === 'CORE' ? '#090D16' : '#F3F4F6'"
                  font-size="10" font-weight="700">{{ n.label }}</text>
            <text y="36" text-anchor="middle" fill="#9CA3AF" font-size="9">
              {{ n.type }}{{ n.latency ? ' · ' + n.latency + 'ms' : '' }}
            </text>
          </g>
        </svg>
      </div>
    </div>
  `
})
export class TopologyComponent implements OnInit {
  nodes: any[] = [];
  links: any[] = [];
  constructor(private tools: ToolsService) {}
  ngOnInit(): void { this.carregar(); }
  carregar(): void {
    this.tools.topology().subscribe(d => { this.nodes = d.nodes; this.links = d.links; });
  }
  getNode(id: any) { return this.nodes.find(n => n.id === id) || { x: 400, y: 300 }; }
}