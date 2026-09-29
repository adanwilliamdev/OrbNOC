'use client';

import { Fragment, type KeyboardEvent } from 'react';
import { Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMs, getLatencyBarColor, getLatencyColor, hasLatency } from '@/lib/latency';
import type { Device, SortDirection, SortField } from '@/types/dashboard';

interface DeviceTableProps {
  devices: Device[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  expandedDevice: number | null;
  onToggleExpand: (id: number) => void;
  pingingDevice: number | null;
  onPingDevice: (id: number) => void;
  onRemoveDevice: (id: number, name: string) => void;
  onRemoveAlertConfig: (id: number) => void;
  onOpenAlertConfig: (device: Device) => void;
}

const STATUS = {
  online: { label: 'ONLINE', dot: 'animate-pulse bg-emerald-500', text: 'text-emerald-300' },
  offline: { label: 'OFFLINE', dot: 'bg-rose-500', text: 'text-rose-400' },
  unknown: { label: 'AGUARDANDO', dot: 'bg-slate-500', text: 'text-slate-400' },
} as const;

function SortableHead({ field, label, active, direction, onSort, className }: { field: SortField; label: string; active: boolean; direction: SortDirection; onSort: (f: SortField) => void; className?: string }) {
  return (
    <TableHead className={className} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 uppercase transition-colors hover:text-slate-200 focus-visible:text-white focus-visible:outline-none">
        {label}
        <span aria-hidden="true" className="w-3 text-[10px]">
          {active ? (direction === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </TableHead>
  );
}

export default function DeviceTable({
  devices,
  sortField,
  sortDirection,
  onSort,
  expandedDevice,
  onToggleExpand,
  pingingDevice,
  onPingDevice,
  onRemoveDevice,
  onRemoveAlertConfig,
  onOpenAlertConfig,
}: DeviceTableProps) {
  const rowKey = (id: number) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    // Só reage quando o foco está na própria linha (não nos botões de dentro dela).
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleExpand(id);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-600/70 bg-slate-800/20">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="status" label="Status" className="w-28" active={sortField === 'status'} direction={sortDirection} onSort={onSort} />
            <SortableHead field="name" label="Dispositivo" active={sortField === 'name'} direction={sortDirection} onSort={onSort} />
            <SortableHead field="ip" label="Host" active={sortField === 'ip'} direction={sortDirection} onSort={onSort} />
            <SortableHead field="latency" label="Latência" className="w-40" active={sortField === 'latency'} direction={sortDirection} onSort={onSort} />
            <TableHead className="w-44">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                Nenhum dispositivo encontrado
              </TableCell>
            </TableRow>
          ) : (
            devices.map((device) => {
              const status = STATUS[device.status];
              const expanded = expandedDevice === device.id;
              const detailsId = `device-details-${device.id}`;
              return (
                <Fragment key={device.id}>
                  <TableRow
                    className="group cursor-pointer hover:bg-slate-700/30 focus-visible:bg-slate-700/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-controls={expanded ? detailsId : undefined}
                    onClick={() => onToggleExpand(device.id)}
                    onKeyDown={rowKey(device.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-200">{device.name}</div>
                      {device.location && <div className="text-[10px] text-slate-400">{device.location}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {device.ip}
                      {device.check_type === 'tcp' && device.port ? <span className="text-slate-500">:{device.port}</span> : null}
                    </TableCell>
                    <TableCell>
                      {device.status === 'online' && hasLatency(device.latency) ? (
                        <div className="flex w-full items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                            <div className={`h-1.5 rounded-full transition-all duration-300 ${getLatencyBarColor(device.latency)}`} style={{ width: `${Math.max(2, Math.min(100, device.latency / 10))}%` }} />
                          </div>
                          <span className={`w-14 text-right font-mono text-xs ${getLatencyColor(device.latency)}`}>{formatMs(device.latency)}</span>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Visível no celular (não há hover); no desktop aparece no hover ou com foco. */}
                      <div className="flex justify-start gap-2 transition-opacity duration-200 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="hover:bg-primary hover:text-white"
                          disabled={pingingDevice === device.id}
                          aria-label={`Testar ${device.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPingDevice(device.id);
                          }}
                        >
                          <Zap className="size-3" /> Ping
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="hover:bg-rose-600 hover:text-white"
                          aria-label={`Remover ${device.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveDevice(device.id, device.name);
                          }}
                        >
                          <Trash2 className="size-3" /> Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow id={detailsId} className="bg-slate-800/30">
                      <TableCell colSpan={5}>
                        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-5">
                          <Detail label="Localização" value={device.location || '—'} />
                          <Detail label="Último check" value={device.last_check ? new Date(device.last_check).toLocaleString() : '—'} />
                          <Detail label="Média / Jitter" value={`${formatMs(device.avg_latency)} / ${formatMs(device.jitter)}`} />
                          <Detail label="Perda de pacotes" value={device.packet_loss != null ? `${device.packet_loss}%` : '—'} />
                          <div>
                            <p className="text-slate-400">Alerta SLA</p>
                            {device.sla_threshold_ms ? (
                              <div className="flex items-center gap-2">
                                <span className={device.sla_breached ? 'text-rose-400' : 'text-yellow-300'}>
                                  Limite: {device.sla_threshold_ms}ms{device.sla_breached ? ' (excedido)' : ''}
                                </span>
                                <button type="button" onClick={() => onRemoveAlertConfig(device.id)} className="text-xs text-rose-400 hover:text-rose-300">
                                  Remover
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => onOpenAlertConfig(device)} className="text-xs text-blue-300 hover:text-blue-200">
                                Configurar alerta
                              </button>
                            )}
                          </div>
                        </div>
                        {device.status === 'offline' && device.last_error && <p className="mt-3 text-xs text-rose-400/80">Último erro: {device.last_error}</p>}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="text-slate-300">{value}</p>
    </div>
  );
}
