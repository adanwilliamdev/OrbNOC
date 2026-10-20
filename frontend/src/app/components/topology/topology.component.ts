import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolsService } from '../../services/tools.service';

const CX = 400;
const CY = 320;

@Component({
  selector: 'app-topology',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content">
      <div class="page-header">
        <div>
          <h1>Topologia de rede</h1>
          <p class="subtitle">O core no centro e os ativos em órbita. Clique em um nó para ver os detalhes.</p>
        </div>
        <button type="button" class="btn-outline" (click)="carregar()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>
          Atualizar
        </button>
      </div>

      <div class="layout">
        <div class="panel map">
          <svg viewBox="0 0 800 640" role="img" aria-label="Mapa da topologia de rede">
            <defs>
              <radialGradient id="coreHalo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#FBBF24" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="#FBBF24" stop-opacity="0"/>
              </radialGradient>
            </defs>

            <!-- Órbitas -->
            <circle class="orbit faint" [attr.cx]="cx" [attr.cy]="cy" r="110"/>
            <circle class="orbit" [attr.cx]="cx" [attr.cy]="cy" r="220"/>
            <circle class="orbit faint" [attr.cx]="cx" [attr.cy]="cy" r="300"/>
            <circle [attr.cx]="cx" [attr.cy]="cy" r="150" fill="url(#coreHalo)"/>

            <!-- Conexões -->
            <g *ngFor="let l of links">
              <line class="link" [class.down]="getNode(l.target).status !== 'UP'"
                    [attr.x1]="getNode(l.source).x" [attr.y1]="getNode(l.source).y"
                    [attr.x2]="getNode(l.target).x" [attr.y2]="getNode(l.target).y"/>
              <circle r="2.5" class="packet" *ngIf="!reduceMotion && getNode(l.target).status === 'UP'">
                <animateMotion dur="3.4s" repeatCount="indefinite"
                  [attr.path]="'M ' + getNode(l.source).x + ' ' + getNode(l.source).y + ' L ' + getNode(l.target).x + ' ' + getNode(l.target).y"/>
              </circle>
            </g>

            <!-- Nós -->
            <g *ngFor="let n of nodes" class="node" [class.core]="n.type === 'CORE'" [class.down]="n.status !== 'UP'" [class.sel]="selecionado?.id === n.id"
               [attr.transform]="'translate(' + n.x + ',' + n.y + ')'"
               tabindex="0" role="button" [attr.aria-label]="n.label + ', ' + (n.status === 'UP' ? 'online' : 'fora do ar')"
               (click)="selecionar(n)" (keydown.enter)="selecionar(n)" (keydown.space)="selecionar(n); $event.preventDefault()">
              <circle class="ring" [attr.r]="n.type === 'CORE' ? 38 : 28"/>
              <text class="code" y="4" text-anchor="middle">{{ codigo(n) }}</text>
              <circle class="led" [attr.cx]="n.type === 'CORE' ? 27 : 20" [attr.cy]="n.type === 'CORE' ? -27 : -20" r="4.5"/>
              <text class="name" [attr.y]="n.type === 'CORE' ? 62 : 50" text-anchor="middle">{{ n.label.length > 16 ? (n.label | slice:0:15) + '…' : n.label }}</text>
              <text class="meta num" [attr.y]="n.type === 'CORE' ? 78 : 65" text-anchor="middle" *ngIf="n.type !== 'CORE'">{{ n.status === 'UP' ? (n.latency != null ? n.latency + ' ms' : 'online') : 'fora do ar' }}</text>
            </g>
          </svg>

          <div class="legend">
            <span><i class="lg ok"></i>Online</span>
            <span><i class="lg bad"></i>Fora do ar</span>
            <span><i class="lg core"></i>Core</span>
          </div>
        </div>

        <aside class="panel detail" aria-live="polite">
          <ng-container *ngIf="selecionado; else nada">
            <div class="d-head">
              <h2>{{ selecionado.label }}</h2>
              <span class="pill" [class.up]="selecionado.status === 'UP'" [class.down]="selecionado.status !== 'UP'">{{ selecionado.status === 'UP' ? 'Online' : 'Fora do ar' }}</span>
            </div>
            <dl>
              <div><dt>Tipo</dt><dd>{{ tipoLabel(selecionado.type) }}</dd></div>
              <div *ngIf="selecionado.ip"><dt>Endereço</dt><dd class="mono">{{ selecionado.ip }}</dd></div>
              <div><dt>Latência</dt><dd class="num">{{ selecionado.latency != null && selecionado.status === 'UP' ? selecionado.latency + ' ms' : '--' }}</dd></div>
              <div><dt>Conexões</dt><dd class="num">{{ selecionado.type === 'CORE' ? links.length : 1 }}</dd></div>
            </dl>
          </ng-container>
          <ng-template #nada>
            <div class="empty">
              <strong>Nenhum nó selecionado</strong>
              <span>Clique em um ativo no mapa para ver status, endereço e latência.</span>
            </div>
          </ng-template>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
    .panel { margin: 0; }
    .map { padding: 12px; position: relative; overflow: hidden; }
    .map svg { width: 100%; height: auto; max-height: 700px; display: block; }
    .orbit { fill: none; stroke: var(--line-strong); stroke-width: 1; }
    .orbit.faint { stroke: var(--line); stroke-dasharray: 2 6; }
    .link { stroke: var(--line-strong); stroke-width: 1.5; }
    .link.down { stroke: var(--crit-line); stroke-dasharray: 4 5; }
    .packet { fill: var(--brand); }

    .node { cursor: pointer; outline: none; }
    .node .ring { fill: var(--surface-2); stroke: var(--ok); stroke-width: 1.75; transition: stroke-width .15s, fill .15s; }
    .node.down .ring { stroke: var(--crit); }
    .node.core .ring { fill: rgba(251, 191, 36, 0.1); stroke: var(--brand); }
    .node:hover .ring, .node:focus-visible .ring, .node.sel .ring { stroke-width: 3; fill: var(--surface-3); }
    .node.core:hover .ring, .node.core.sel .ring { fill: rgba(251, 191, 36, 0.18); }
    .node .code { font-family: var(--font-mono); font-size: 11px; font-weight: 500; fill: var(--text); letter-spacing: .04em; }
    .node.core .code { fill: var(--brand); font-size: 13px; }
    .node .led { fill: var(--ok); stroke: var(--surface); stroke-width: 2; }
    .node.down .led { fill: var(--crit); }
    .node.core .led { fill: var(--brand); }
    .node .name, .node .meta { paint-order: stroke; stroke: var(--surface); stroke-width: 5px; stroke-linejoin: round; }
    .node .name { font-size: 12px; font-weight: 500; fill: var(--text); }
    .node .meta { font-size: 11px; fill: var(--text-3); }
    .node.down .meta { fill: var(--crit); }

    .legend { position: absolute; left: 20px; bottom: 16px; display: flex; gap: 16px; font-size: 12px; color: var(--text-2); }
    .legend span { display: inline-flex; align-items: center; gap: 7px; }
    .lg { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .lg.ok { background: var(--ok); } .lg.bad { background: var(--crit); } .lg.core { background: var(--brand); }

    .d-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
    .d-head h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    dl { margin: 0; display: flex; flex-direction: column; gap: 12px; }
    dl div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    dt { font-size: 13px; color: var(--text-3); }
    dd { margin: 0; font-size: 14px; font-weight: 500; }

    @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class TopologyComponent implements OnInit {
  nodes: any[] = [];
  links: any[] = [];
  selecionado: any = null;
  readonly cx = CX;
  readonly cy = CY;
  readonly reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  private readonly tipos: Record<string, string> = { CORE: 'Core', SWITCH: 'Switch', ROUTER: 'Roteador', FIREWALL: 'Firewall', SERVER: 'Servidor' };
  private readonly codigos: Record<string, string> = { CORE: 'CORE', SWITCH: 'SW', ROUTER: 'RT', FIREWALL: 'FW', SERVER: 'SV' };

  constructor(private tools: ToolsService) {}

  ngOnInit(): void { this.carregar(); }

  carregar(): void {
    this.tools.topology().subscribe(d => {
      // O core fica no centro da órbita para não colidir com o primeiro ativo.
      this.nodes = (d.nodes || []).map((n: any) => n.type === 'CORE' ? { ...n, x: CX, y: CY } : n);
      this.links = d.links || [];
      this.selecionado = this.selecionado ? this.nodes.find(n => n.id === this.selecionado.id) || null : null;
    });
  }

  getNode(id: any) { return this.nodes.find(n => n.id === id) || { x: CX, y: CY, status: 'UP' }; }
  selecionar(n: any) { this.selecionado = n; }
  tipoLabel(t: string): string { return this.tipos[t] || t; }
  codigo(n: any): string { return this.codigos[n.type] || (n.type || '??').slice(0, 2); }
}
