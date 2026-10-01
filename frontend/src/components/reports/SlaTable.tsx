import { Badge } from '@/components/ui/badge';
import { formatMs } from '@/lib/latency';
import { pct } from '@/lib/format';
import type { SlaRow, SlaWindow } from '@/types/dashboard';

const STATUS = {
  online: { label: 'Online', variant: 'success' },
  offline: { label: 'Offline', variant: 'destructive' },
  unknown: { label: 'Aguardando', variant: 'secondary' },
} as const;

export default function SlaTable({ rows, window, loading }: { rows: SlaRow[]; window: SlaWindow; loading?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <h2 className="text-sm font-semibold text-foreground">SLA por dispositivo ({window})</h2>
        <p className="mt-0.5 text-xs text-subtle">Uptime = amostras com resposta ÷ amostras totais na janela.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Status', 'Nome', 'Host', 'Uptime', 'Latência média', 'Amostras', 'Limite SLA', 'Localização'].map((h) => (
                <th key={h} scope="col" className="h-11 px-4 text-left text-xs font-medium whitespace-nowrap text-subtle">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-subtle">
                  {loading ? 'Carregando...' : 'Nenhum dispositivo monitorado'}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const status = STATUS[r.status];
              return (
                <tr key={r.device_id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.ip}</td>
                  <td className="px-4 py-3 text-foreground tabular-nums">{pct(r.uptime_pct)}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatMs(r.avg_latency)}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.sample_count}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.sla_threshold_ms ? `${r.sla_threshold_ms}ms` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-subtle">{r.location || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
