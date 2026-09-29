'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCheck } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { useAckAlerts, useAlerts } from '@/hooks/use-alerts';
import type { AlertEvent } from '@/types/dashboard';

type Filter = 'all' | 'critical' | 'warning' | 'recovery' | 'info';

const FILTERS: { value: Filter; label: string; active: string }[] = [
  { value: 'all', label: 'Todos', active: 'bg-blue-600 text-white' },
  { value: 'critical', label: '🔴 Críticos', active: 'bg-rose-600 text-white' },
  { value: 'warning', label: '🟠 Atenção', active: 'bg-amber-600 text-white' },
  { value: 'recovery', label: '🟢 Recuperações', active: 'bg-emerald-600 text-white' },
  { value: 'info', label: 'ℹ️ Informações', active: 'bg-blue-600 text-white' },
];

const isCritical = (a: AlertEvent) => a.severity === 'error';
const isRecovery = (a: AlertEvent) => a.kind === 'recovered';
const isInfo = (a: AlertEvent) => a.severity === 'info' || (a.severity === 'success' && !isRecovery(a));

const matches = (a: AlertEvent, f: Filter) =>
  f === 'all' || (f === 'critical' && isCritical(a)) || (f === 'warning' && a.severity === 'warning') || (f === 'recovery' && isRecovery(a)) || (f === 'info' && isInfo(a));

const TONE = {
  error: { card: 'border-rose-500/30 bg-rose-500/10 hover:border-rose-500/50', badge: 'bg-rose-500/20 text-rose-400', icon: '🔴', title: 'CRÍTICO' },
  warning: { card: 'border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50', badge: 'bg-amber-500/20 text-amber-400', icon: '🟠', title: 'ALERTA' },
  success: { card: 'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/50', badge: 'bg-emerald-500/20 text-emerald-400', icon: '🟢', title: 'RECUPERADO' },
  info: { card: 'border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50', badge: 'bg-blue-500/20 text-blue-400', icon: 'ℹ️', title: 'INFO' },
} as const;

export default function AlertsPage() {
  const { alerts, unread, isLoading } = useAlerts(200);
  const { ackOne, ackAll } = useAckAlerts();
  const [filter, setFilter] = useState<Filter>('all');

  const stats = useMemo(
    () => ({
      critical: alerts.filter(isCritical).length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      recovery: alerts.filter(isRecovery).length,
      info: alerts.filter(isInfo).length,
    }),
    [alerts],
  );
  const filtered = useMemo(() => alerts.filter((a) => matches(a, filter)), [alerts, filter]);
  const chartData = useMemo(
    () =>
      alerts
        .slice(0, 20)
        .reverse()
        .map((a) => ({ time: new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), severity: a.severity === 'error' ? 3 : a.severity === 'warning' ? 2 : 1 })),
    [alerts],
  );

  const cards = [
    { label: 'Alertas Críticos', hint: 'Requer ação imediata', value: stats.critical, icon: '🔴', color: 'text-rose-400', border: 'border-rose-500/20 hover:border-rose-500/40' },
    { label: 'Alertas de Atenção', hint: 'Monitorar de perto', value: stats.warning, icon: '🟠', color: 'text-amber-400', border: 'border-amber-500/20 hover:border-amber-500/40' },
    { label: 'Recuperações', hint: 'Hosts restaurados', value: stats.recovery, icon: '🟢', color: 'text-emerald-400', border: 'border-emerald-500/20 hover:border-emerald-500/40' },
    { label: 'Informações', hint: 'Eventos normais', value: stats.info, icon: 'ℹ️', color: 'text-blue-400', border: 'border-blue-500/20 hover:border-blue-500/40' },
  ];

  return (
    <PageShell
      title="Centro de Alertas"
      subtitle="Histórico de incidentes guardado no servidor"
      icon="🚨"
      actions={
        <Button variant="outline" onClick={() => ackAll.mutate()} disabled={unread === 0 || ackAll.isPending}>
          <CheckCheck /> Marcar todos como lidos{unread > 0 ? ` (${unread})` : ''}
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 transition-all ${c.border}`}>
            <div className="flex items-center justify-between">
              <span aria-hidden="true" className="text-2xl">{c.icon}</span>
              <span className={`text-2xl font-bold ${c.color}`}>{c.value}</span>
            </div>
            <p className={`mt-1 text-sm font-medium ${c.color}`}>{c.label}</p>
            <p className="mt-1 text-[10px] text-slate-500">{c.hint}</p>
          </div>
        ))}
      </div>

      {chartData.length > 1 && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-rose-500 to-amber-500" />
            Tendência de Alertas
          </h2>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} ticks={[1, 2, 3]} domain={[0, 3]} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                <Area type="monotone" dataKey="severity" name="Severidade" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar alertas">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${filter === f.value ? f.active : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Carregando alertas...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center">
          <span aria-hidden="true" className="mb-3 block text-4xl">✅</span>
          <p className="text-slate-400">Nenhum alerta registrado</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.slice(0, 100).map((alert) => {
            const tone = TONE[alert.severity];
            const read = alert.acknowledged_at !== null;
            return (
              <li key={alert.id} className={`rounded-xl border p-4 transition-all ${tone.card} ${read ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-xl">{tone.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${tone.badge}`}>{tone.title}</span>
                      <time dateTime={alert.created_at} className="text-xs text-slate-500">
                        {new Date(alert.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-2 text-slate-200">{alert.message}</p>
                  </div>
                  {!read && (
                    <Button size="sm" variant="ghost" onClick={() => ackOne.mutate(alert.id)} disabled={ackOne.isPending}>
                      Marcar como lido
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
