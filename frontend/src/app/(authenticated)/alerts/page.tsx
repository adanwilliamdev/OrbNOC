'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCheck, CircleCheck, Info, OctagonAlert, Siren, TriangleAlert } from 'lucide-react';
import { StatTile } from '@/components/ui/stat';
import { chart, tooltipLabelStyle, tooltipStyle } from '@/lib/theme';
import { cn } from '@/lib/utils';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { useAckAlerts, useAlerts } from '@/hooks/use-alerts';
import type { AlertEvent } from '@/types/dashboard';

type Filter = 'all' | 'critical' | 'warning' | 'recovery' | 'info';

const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'critical', label: 'Críticos', dot: 'bg-bad' },
  { value: 'warning', label: 'Atenção', dot: 'bg-warn' },
  { value: 'recovery', label: 'Recuperações', dot: 'bg-ok' },
  { value: 'info', label: 'Informações', dot: 'bg-subtle' },
];

const isCritical = (a: AlertEvent) => a.severity === 'error';
const isRecovery = (a: AlertEvent) => a.kind === 'recovered';
const isInfo = (a: AlertEvent) => a.severity === 'info' || (a.severity === 'success' && !isRecovery(a));

const matches = (a: AlertEvent, f: Filter) =>
  f === 'all' || (f === 'critical' && isCritical(a)) || (f === 'warning' && a.severity === 'warning') || (f === 'recovery' && isRecovery(a)) || (f === 'info' && isInfo(a));

const TONE = {
  error: { rail: 'bg-bad', badge: 'bg-bad/15 text-bad', icon: OctagonAlert, iconColor: 'text-bad', title: 'Crítico' },
  warning: { rail: 'bg-warn', badge: 'bg-warn/15 text-warn', icon: TriangleAlert, iconColor: 'text-warn', title: 'Atenção' },
  success: { rail: 'bg-ok', badge: 'bg-ok/15 text-ok', icon: CircleCheck, iconColor: 'text-ok', title: 'Recuperado' },
  info: { rail: 'bg-subtle', badge: 'bg-muted text-muted-foreground', icon: Info, iconColor: 'text-subtle', title: 'Info' },
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
    { label: 'Críticos', hint: 'Requerem ação imediata', value: stats.critical, icon: <OctagonAlert />, tone: 'bad' as const },
    { label: 'Atenção', hint: 'Monitorar de perto', value: stats.warning, icon: <TriangleAlert />, tone: 'warn' as const },
    { label: 'Recuperações', hint: 'Hosts restaurados', value: stats.recovery, icon: <CircleCheck />, tone: 'ok' as const },
    { label: 'Informações', hint: 'Eventos normais', value: stats.info, icon: <Info />, tone: 'neutral' as const },
  ];

  return (
    <PageShell
      title="Centro de alertas"
      subtitle="Histórico de incidentes guardado no servidor"
      icon={<Siren />}
      actions={
        <Button variant="outline" onClick={() => ackAll.mutate()} disabled={unread === 0 || ackAll.isPending}>
          <CheckCheck /> Marcar todos como lidos{unread > 0 ? ` (${unread})` : ''}
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatTile key={c.label} label={c.label} hint={c.hint} value={c.value} icon={c.icon} tone={c.value > 0 ? c.tone : 'neutral'} />
        ))}
      </div>

      {chartData.length > 1 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Tendência de alertas</h2>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="time" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} ticks={[1, 2, 3]} domain={[0, 3]} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Area type="monotone" dataKey="severity" name="Severidade" stroke={chart.bad} fill={chart.bad} fillOpacity={0.15} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filtrar alertas">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150',
              filter === f.value ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.05)]' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.dot && <span className={cn('size-1.5 rounded-full', f.dot)} />}
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Carregando alertas...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CircleCheck className="mx-auto mb-3 size-7 text-ok" />
          <p className="text-sm font-medium text-foreground">Nenhum alerta registrado</p>
          <p className="mt-1 text-xs text-subtle">Quando algo mudar na rede, aparece aqui.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.slice(0, 100).map((alert) => {
            const tone = TONE[alert.severity];
            const Icon = tone.icon;
            const read = alert.acknowledged_at !== null;
            return (
              <li key={alert.id} className={cn('flex items-stretch gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-strong', read && 'opacity-60')}>
                <span aria-hidden="true" className={cn('w-0.5 shrink-0 rounded-full', tone.rail)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', tone.badge)}>
                      <Icon className="size-3.5" /> {tone.title}
                    </span>
                    <time dateTime={alert.created_at} className="text-xs text-subtle">
                      {new Date(alert.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{alert.message}</p>
                </div>
                {!read && (
                  <Button size="sm" variant="ghost" className="self-center" onClick={() => ackOne.mutate(alert.id)} disabled={ackOne.isPending}>
                    Marcar como lido
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
