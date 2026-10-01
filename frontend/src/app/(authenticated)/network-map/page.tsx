'use client';

import { useCallback, useMemo, useState } from 'react';
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, MarkerType, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Map as MapIcon, Server, X } from 'lucide-react';
import { StatTile } from '@/components/ui/stat';
import { cn } from '@/lib/utils';
import PageShell from '@/components/layout/PageShell';
import { useDevices } from '@/hooks/use-devices';
import { formatMs, hasLatency } from '@/lib/latency';
import type { Device, DeviceStatus } from '@/types/dashboard';

type ViewMode = 'hierarchical' | 'radial' | 'grid';

interface NodeData extends Record<string, unknown> {
  label: string;
  ip: string;
  status: DeviceStatus | 'core';
  latency: number | null;
}
type TopoNode = Node<NodeData, 'custom'>;

const COLOR = { online: 'var(--ok)', offline: 'var(--bad)', unknown: 'var(--subtle)', core: 'var(--primary)' } as const;

function CustomNode({ data }: NodeProps<TopoNode>) {
  const color = COLOR[data.status];
  const text = data.status === 'core' ? 'Gateway' : data.status === 'online' ? 'Online' : data.status === 'offline' ? 'Offline' : 'Aguardando';
  return (
    <div className="group relative cursor-pointer">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className={cn('min-w-[140px] rounded-xl border bg-card p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)] transition-transform duration-200 hover:scale-105', data.status === 'core' && 'bg-primary/10')} style={{ borderColor: data.status === 'core' ? color : 'var(--border)', borderTopColor: color, borderTopWidth: 3 }}>
        <div className="mb-2 flex items-center gap-2">
          <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate font-mono text-[11px] text-subtle">{data.ip || '—'}</span>
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{data.label}</p>
        {hasLatency(data.latency) && <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{formatMs(data.latency)}</p>}
        <div className="mt-2 border-t border-border pt-2">
          <span className="text-xs font-medium" style={{ color }}>
            {text}
          </span>
        </div>
      </div>
      {data.status === 'offline' && <div className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-bad" />}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function position(index: number, total: number, mode: ViewMode): { x: number; y: number } {
  if (mode === 'hierarchical') return { x: 120 + (index % 4) * 190, y: 220 + Math.floor(index / 4) * 110 };
  if (mode === 'radial') {
    const angle = (index / Math.max(total, 1)) * 2 * Math.PI;
    return { x: 400 + 220 * Math.cos(angle), y: 280 + 220 * Math.sin(angle) };
  }
  const cols = Math.ceil(Math.sqrt(Math.max(total, 1)));
  return { x: 80 + (index % cols) * 210, y: 180 + Math.floor(index / cols) * 120 };
}

function buildTopology(devices: Device[], mode: ViewMode, coreStatus: DeviceStatus): { nodes: TopoNode[]; edges: Edge[] } {
  const ordered = [...devices.filter((d) => d.status === 'online'), ...devices.filter((d) => d.status !== 'online')];
  const nodes: TopoNode[] = [{ id: 'core', type: 'custom', position: { x: 400, y: 50 }, data: { label: 'Core / Internet', ip: 'Gateway Principal', status: coreStatus === 'online' ? 'core' : coreStatus, latency: null }, zIndex: 10 }];
  const edges: Edge[] = [];
  ordered.forEach((d, i) => {
    nodes.push({ id: String(d.id), type: 'custom', position: position(i, ordered.length, mode), data: { label: d.name, ip: d.ip, status: d.status, latency: d.latency } });
    const color = COLOR[d.status];
    edges.push({
      id: `edge-core-${d.id}`,
      source: 'core',
      target: String(d.id),
      type: 'smoothstep',
      animated: d.status === 'online',
      style: { stroke: color, strokeWidth: 1.5, strokeDasharray: d.status === 'online' ? undefined : '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    });
  });
  return { nodes, edges };
}

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'hierarchical', label: 'Hierárquico' },
  { value: 'radial', label: 'Radial' },
  { value: 'grid', label: 'Grade' },
];

export default function NetworkMapPage() {
  const { devices, stats, isLoading } = useDevices();
  const [mode, setMode] = useState<ViewMode>('hierarchical');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derivado do cache do WebSocket: o mapa atualiza sozinho, sem estado duplicado.
  const { nodes, edges } = useMemo(() => buildTopology(devices, mode, stats.availability >= 50 ? 'online' : 'offline'), [devices, mode, stats.availability]);
  const selected = selectedId ? nodes.find((n) => n.id === selectedId) : undefined;
  const onNodeClick = useCallback((_: unknown, node: Node) => setSelectedId(node.id), []);

  return (
    <PageShell
      title="Mapa de rede"
      subtitle="Visualização topológica da infraestrutura em tempo real"
      icon={<MapIcon />}
      actions={
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Modo de visualização">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ${mode === m.value ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.05)]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Online" tone="ok" value={stats.online} icon={<Check />} />
        <StatTile label="Offline" tone={stats.offline > 0 ? 'bad' : 'neutral'} value={stats.offline} icon={<X />} />
        <StatTile label="Disponibilidade" value={`${stats.availability}%`} />
        <StatTile label="Total" value={stats.total} icon={<Server />} />
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">Carregando mapa de rede...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div style={{ height: 'calc(100vh - 340px)', minHeight: 480 }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onNodeClick} onPaneClick={() => setSelectedId(null)} nodesConnectable={false} colorMode="dark" fitView attributionPosition="bottom-right">
              <Background color="var(--border-strong)" gap={22} size={1} />
              <Controls />
              <MiniMap nodeColor={(n) => COLOR[(n.data as NodeData | undefined)?.status ?? 'unknown']} maskColor="rgb(0 0 0 / 0.55)" />
            </ReactFlow>
          </div>
        </div>
      )}

      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {[
          ['bg-ok', 'Online'],
          ['bg-bad', 'Offline'],
          ['bg-subtle', 'Aguardando'],
          ['bg-primary', 'Core/Gateway'],
        ].map(([cls, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${cls}`} />
            {label}
          </li>
        ))}
      </ul>

      {selected && (
        <div role="status" className="animate-fade-in fixed bottom-6 left-1/2 z-50 min-w-[220px] -translate-x-1/2 rounded-xl border border-border bg-popover p-4 shadow-pop">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full" style={{ backgroundColor: COLOR[selected.data.status] }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{selected.data.label}</p>
              <p className="font-mono text-xs text-subtle">{selected.data.ip}</p>
              {hasLatency(selected.data.latency) && <p className="mt-1 text-xs text-muted-foreground">Latência: {formatMs(selected.data.latency)}</p>}
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Fechar detalhes" className="text-subtle transition-colors hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
