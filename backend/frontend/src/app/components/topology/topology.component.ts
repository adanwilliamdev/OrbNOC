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
          <p class="subtitle">Mapa visual da infraestrutura — Core + ativos conectados</p>
        </div>
        <button class="btn-outline" (click)="carregar()">&#8635; Atualizar</button>
      </div>

      <div class="panel" style="overflow:auto;">
        <svg viewBox="0 0 800 600" style="width:100%; height:600px; display:block;">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="800" height="600" fill="url(#grid)"/>

          <!-- Links -->
          <line *ngFor="let link of links"
                [attr.x1]="getNode(link.source).x" [attr.y1]="getNode(link.source).y"
                [attr.x2]="getNode(link.target).x" [attr.y2]="getNode(link.target).y"
                stroke="rgba(251,191,36,0.25)" stroke-width="2" stroke-dasharray="4 4"/>

          <!-- Nodes -->
          <g *ngFor="let node of nodes" [attr.transform]="'translate(' + node.x + ',' + node.y + ')'">
            <!-- Halo -->
            <circle r="40" [attr.fill]="node.status === 'UP' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'"/>
            <!-- Node -->
            <rect x="-28" y="-20" width="56" height="40" rx="8"
                  [attr.fill]="node.type === 'CORE' ? '#FBBF24' : '#111827'"
                  [attr.stroke]="node.type === 'CORE' ? '#F59E0B' : (node.status === 'UP' ? '#10B981' : '#EF4444')"
                  stroke-width="2"/>
            <text y="4" text-anchor="middle"
                  [attr.fill]="node.type === 'CORE' ? '#090D16' : '#F3F4F6'"
                  font-size="10" font-weight="700">{{ node.label }}</text>
            <text y="36" text-anchor="middle" fill="#9CA3AF" font-size="9">
              {{ node.type }}{{ node.latency ? ' · ' + node.latency + 'ms' : '' }}
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
    this.tools.topology().subscribe(data => {
      this.nodes = data.nodes;
      this.links = data.links;
    });
  }
  getNode(id: any) {
    return this.nodes.find(n => n.id === id) || { x: 400, y: 300 };
  }
}