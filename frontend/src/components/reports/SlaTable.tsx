import { formatMs } from '@/lib/latency';
import { pct } from '@/lib/format';
import type { SlaRow, SlaWindow } from '@/types/dashboard';

export default function SlaTable({ rows, window, loading }: { rows: SlaRow[]; window: SlaWindow; loading?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50">
      <div className="border-b border-slate-700 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <span className="h-4 w-1 rounded-full bg-purple-500" />
          SLA por dispositivo ({window})
        </h2>
        <p className="mt-1 text-xs text-slate-500">Uptime = amostras com resposta ÷ amostras totais na janela.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50">
            <tr>
              {['Status', 'Nome', 'Host', 'Uptime', 'Latência média', 'Amostras', 'Limite SLA', 'Localização'].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-slate-400 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  {loading ? 'Carregando...' : 'Nenhum dispositivo monitorado'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.device_id} className="transition-colors hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${r.status === 'online' ? 'text-emerald-400' : r.status === 'offline' ? 'text-rose-400' : 'text-slate-400'}`}>{r.status === 'online' ? '🟢 ONLINE' : r.status === 'offline' ? '🔴 OFFLINE' : '⚪ AGUARDANDO'}</span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-200">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.ip}</td>
                <td className="px-4 py-3 text-slate-300">{pct(r.uptime_pct)}</td>
                <td className="px-4 py-3 text-slate-300">{formatMs(r.avg_latency)}</td>
                <td className="px-4 py-3 text-slate-400">{r.sample_count}</td>
                <td className="px-4 py-3 text-slate-400">{r.sla_threshold_ms ? `${r.sla_threshold_ms}ms` : '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.location || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
