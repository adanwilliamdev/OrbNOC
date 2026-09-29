'use client';

import { useCallback, useMemo, useState } from 'react';
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, MarkerType, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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

const COLOR = { online: '#10b981', offline: '#ef4444', unknown: '#64748b', core: '#3b82f6' } as const;

function CustomNode({ data }: NodeProps<TopoNode>) {
  const color = COLOR[data.status];
  const text = data.status === 'core' ? 'GATEWAY' : data.status === 'online' ? 'ONLINE' : data.status === 'offline' ? 'OFFLINE' : 'AGUARDANDO';
  return (
    <div className="group relative cursor-pointer">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="min-w-[140px] rounded-xl border-2 bg-gradient-to-br from-slate-800 to-slate-900 p-3 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl" style={{ borderColor: color }}>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate font-mono text-[10px] text-slate-500">{data.ip || '—'}</span>
        </div>
        <p className="truncate text-sm font-semibold text-slate-200">{data.label}</p>
        {hasLatency(data.latency) && <p className="mt-1 text-xs text-slate-400">⚡ {formatMs(data.latency)}</p>}
        <div className="mt-2 border-t border-slate-700/50 pt-2">
          <span className="text-[10px] font-medium" style={{ color }}>
            {text}
          </span>
        </div>
      </div>
      {data.status === 'offline' && <div className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-rose-500" />}
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
  const nodes: TopoNode[] = [{ id: 'core', type: 'custom', position: { x: 400, y: 50 }, data: { label: '🌐 Core / Internet', ip: 'Gateway Principal', status: coreStatus === 'online' ? 'core' : coreStatus, latency: null }, zIndex: 10 }];
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
      style: { stroke: color, strokeWidth: 2, strokeDasharray: d.status === 'online' ? undefined : '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    });
  });
  return { nodes, edges };
}

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'hierarchical', label: '🌳 Hierárquico' },
  { value: 'radial', label: '🕸️ Radial' },
  { value: 'grid', label: '📐 Grade' },
];

export default function NetworkMapPage() {
  const { devices, stats, isLoading } = useDevices();
  const [mode, setMode] = useState<ViewMode>('hierarchical');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derivado do cache do WebSocket: o mapa atualiza sozinho, sem estado duplicado.
  const { nodes, edges } = useMemo(() => buildTopology(devices, mode, stats.availability >= 50 ? 'online' : 'offline'), [devices, mode, stats.availability]);
  const selected = selectedId ? nodes.find((n) => n.id === selectedId) : undefined;
  const onNodeClick = useCallback((_: unknown, node: Node) => setSelectedId(node.id), []);

  const summary = [
    { label: '🟢 ONLINE', value: stats.online, color: 'text-emerald-400' },
    { label: '🔴 OFFLINE', value: stats.offline, color: 'text-rose-400' },
    { label: '📊 DISPONIBILIDADE', value: `${stats.availability}%`, color: 'text-blue-400' },
    { label: '🖥️ TOTAL', value: stats.total, color: 'text-indigo-400' },
  ];

  return (
    <PageShell
      title="Mapa de Rede"
      subtitle="Visualização topológica da infraestrutura em tempo real"
      icon="🗺️"
      actions={
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800/30 p-1" role="group" aria-label="Modo de visualização">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${mode === m.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-slate-400">Carregando mapa de rede...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/20 shadow-2xl">
          <div style={{ height: 'calc(100vh - 340px)', minHeight: 480 }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onNodeClick} onPaneClick={() => setSelectedId(null)} nodesConnectable={false} colorMode="dark" fitView attributionPosition="bottom-right">
              <Background color="#1e293b" gap={20} size={0.5} />
              <Controls />
              <MiniMap nodeColor={(n) => COLOR[(n.data as NodeData | undefined)?.status ?? 'unknown']} maskColor="rgba(0, 0, 0, 0.6)" />
            </ReactFlow>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
        {[
          ['bg-emerald-500 animate-pulse', 'Online'],
          ['bg-rose-500', 'Offline'],
          ['bg-slate-500', 'Aguardando'],
          ['bg-blue-500', 'Core/Gateway'],
        ].map(([cls, label]) => (
          <div key={label} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5">
            <div className={`h-3 w-3 rounded-full ${cls}`} />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {selected && (
        <div role="status" className="animate-fade-in fixed bottom-6 left-1/2 z-50 min-w-[220px] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[selected.data.status] }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">{selected.data.label}</p>
              <p className="font-mono text-xs text-slate-500">{selected.data.ip}</p>
              {hasLatency(selected.data.latency) && <p className="mt-1 text-xs text-amber-400">⚡ Latência: {formatMs(selected.data.latency)}</p>}
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Fechar detalhes" className="text-slate-500 transition-colors hover:text-slate-300">
              ✕
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
