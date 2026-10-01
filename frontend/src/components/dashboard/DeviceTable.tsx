'use client';

import { Fragment, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, SearchX, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  online: { label: 'Online', variant: 'success' },
  offline: { label: 'Offline', variant: 'destructive', halo: true },
  unknown: { label: 'Aguardando', variant: 'secondary' },
} as const;

function SortableHead({ field, label, active, direction, onSort, className }: { field: SortField; label: string; active: boolean; direction: SortDirection; onSort: (f: SortField) => void; className?: string }) {
  return (
    <TableHead className={className} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none', active && 'text-foreground')}>
        {label}
        <span aria-hidden="true" className="w-3">
          {active && (direction === 'asc' ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />)}
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
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
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
              <TableCell colSpan={5} className="py-14 text-center">
                <SearchX className="mx-auto mb-3 size-6 text-subtle" />
                <p className="text-sm font-medium text-foreground">Nenhum dispositivo encontrado</p>
                <p className="mt-1 text-xs text-subtle">Ajuste a busca ou os filtros, ou adicione um novo equipamento.</p>
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
                    className="group cursor-pointer hover:bg-accent/50 focus-visible:bg-accent/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-controls={expanded ? detailsId : undefined}
                    onClick={() => onToggleExpand(device.id)}
                    onKeyDown={rowKey(device.id)}
                  >
                    <TableCell>
                      <Badge variant={status.variant} dot className={cn('halo' in status && '[&>span]:animate-halo')}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{device.name}</div>
                      {device.location && <div className="text-xs text-subtle">{device.location}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {device.ip}
                      {device.check_type === 'tcp' && device.port ? <span className="text-subtle">:{device.port}</span> : null}
                    </TableCell>
                    <TableCell>
                      {device.status === 'online' && hasLatency(device.latency) ? (
                        <div className="flex w-full items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div className={`h-1.5 rounded-full transition-all duration-300 ${getLatencyBarColor(device.latency)}`} style={{ width: `${Math.max(2, Math.min(100, device.latency / 10))}%` }} />
                          </div>
                          <span className={`w-14 text-right font-mono text-xs tabular-nums ${getLatencyColor(device.latency)}`}>{formatMs(device.latency)}</span>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Visível no celular (não há hover); no desktop aparece no hover ou com foco. */}
                      <div className="flex justify-start gap-2 transition-opacity duration-200 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="outline"
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
                          variant="ghost"
                          className="hover:bg-bad/15 hover:text-bad"
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
                    <TableRow id={detailsId} className="bg-muted/40">
                      <TableCell colSpan={5}>
                        <div className="animate-fade-in grid grid-cols-2 gap-4 text-xs md:grid-cols-6">
                          <Detail label="Localização" value={device.location || '—'} />
                          <Detail label="Último check" value={device.last_check ? new Date(device.last_check).toLocaleString() : '—'} />
                          <Detail label="Média / Jitter" value={`${formatMs(device.avg_latency)} / ${formatMs(device.jitter)}`} />
                          <Detail label="Perda de pacotes" value={device.packet_loss != null ? `${device.packet_loss}%` : '—'} />
                          <Detail label="Checagem" value={`a cada ${device.interval_seconds}s`} />
                          <div>
                            <p className="text-subtle">Alerta SLA</p>
                            {device.sla_threshold_ms ? (
                              <div className="flex items-center gap-2">
                                <span className={device.sla_breached ? 'text-bad' : 'text-muted-foreground'}>
                                  Limite: {device.sla_threshold_ms}ms{device.sla_breached ? ' (excedido)' : ''}
                                </span>
                                <button type="button" onClick={() => onRemoveAlertConfig(device.id)} className="text-xs text-bad hover:underline">
                                  Remover
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => onOpenAlertConfig(device)} className="text-xs font-medium text-primary hover:underline">
                                Configurar alerta
                              </button>
                            )}
                          </div>
                        </div>
                        {device.status === 'offline' && device.last_error && <p className="mt-3 text-xs text-bad/90">Último erro: {device.last_error}</p>}
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
      <p className="text-subtle">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
