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
          <p class="subtitle">Mapa visual da infraestrutura — Core e ativos conectados em tempo real</p>
        </div>
        <button class="btn-outline" (click)="carregar()">&#8635; Atualizar</button>
      </div>

      <div class="panel" style="padding: 8px; overflow: hidden;">
        <svg viewBox="0 0 800 640" style="width:100%; height:640px; display:block;">
          <defs>
            <radialGradient id="coreHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#FBBF24" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#FBBF24" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="upHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#10B981" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="downHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#EF4444" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="#EF4444" stop-opacity="0"/>
            </radialGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="softGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <!-- Links: base + linha de pulso + ponto viajante -->
          <g *ngFor="let l of links; let i = index">
            <line [attr.x1]="getNode(l.source).x" [attr.y1]="getNode(l.source).y"
                  [attr.x2]="getNode(l.target).x" [attr.y2]="getNode(l.target).y"
                  stroke="rgba(99,102,241,0.15)" stroke-width="2"/>

            <line class="data-pulse"
                  [attr.x1]="getNode(l.source).x" [attr.y1]="getNode(l.source).y"
                  [attr.x2]="getNode(l.target).x" [attr.y2]="getNode(l.target).y"
                  stroke="#6366F1" stroke-width="1.5" stroke-dasharray="8 250"
                  style="filter: drop-shadow(0 0 4px #6366F1);"
                  [style.animation-delay]="(i * 0.3) + 's'"/>

            <circle r="3" fill="#A5B4FC" filter="url(#softGlow)">
              <animateMotion dur="3s" repeatCount="indefinite"
                             [attr.path]="'M ' + getNode(l.source).x + ' ' + getNode(l.source).y +
                                          ' L ' + getNode(l.target).x + ' ' + getNode(l.target).y"/>
            </circle>
          </g>

          <!-- Nós -->
          <g *ngFor="let n of nodes" [attr.transform]="'translate(' + n.x + ',' + n.y + ')'" class="node-group">
            <circle r="60" [attr.fill]="n.type === 'CORE' ? 'url(#coreHalo)' : (n.status === 'UP' ? 'url(#upHalo)' : 'url(#downHalo)')"/>
            <circle r="32"
                    [attr.fill]="n.type === 'CORE' ? 'rgba(251,191,36,0.12)' : 'rgba(17,24,39,0.7)'"
                    [attr.stroke]="n.type === 'CORE' ? '#FBBF24' : (n.status === 'UP' ? '#10B981' : '#EF4444')"
                    stroke-width="1.5"/>
            <text y="4" text-anchor="middle"
                  [attr.fill]="n.type === 'CORE' ? '#FBBF24' : '#F9FAFB'"
                  font-size="11" font-weight="700" font-family="Plus Jakarta Sans">
              {{ n.label | slice:0:8 }}
            </text>
            <circle cy="-24" r="4"
                    [attr.fill]="n.status === 'UP' ? '#10B981' : '#EF4444'"
                    filter="url(#glow)"/>
            <text y="56" text-anchor="middle" fill="#9CA3AF" font-size="10" font-family="Plus Jakarta Sans"
                  dominant-baseline="middle">
              {{ n.type }}{{ n.latency ? ' · ' + n.latency + 'ms' : '' }}
            </text>
          </g>
        </svg>
      </div>
    </div>
  `,
  styles: [`
    .node-group { cursor: pointer; }
    .node-group:hover circle:nth-child(2) { stroke-width: 2.5; }
    .data-pulse { animation: pulseFlow 3s linear infinite; }
    @keyframes pulseFlow {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -258; }
    }
  `]
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