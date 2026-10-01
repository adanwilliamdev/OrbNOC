'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Check, Server, X, Zap } from 'lucide-react';
import FleetStrip from '@/components/dashboard/FleetStrip';
import { Card } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat';
import { hasLatency } from '@/lib/latency';
import { chart } from '@/lib/theme';
import { cn, stagger } from '@/lib/utils';
import type { Device, HistoryEntry, LatencyTrend } from '@/types/dashboard';

interface KpiPanelProps {
  devices: Device[];
  totalDevices: number;
  online: number;
  offline: number;
  availability: number;
  avgLatency: number | null;
  latencyTrend: LatencyTrend;
  /** Série cronológica (mais antigo primeiro). */
  history: HistoryEntry[];
}

export default function KpiPanel({ devices, totalDevices, online, offline, availability, avgLatency, latencyTrend, history }: KpiPanelProps) {
  const hasOffline = offline > 0;
  const sparkline = history.slice(-24);
  const monitored = online + offline;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
      {/* O herói do painel: disponibilidade agora + um tique por dispositivo. */}
      <Card className="reveal col-span-2 flex flex-col justify-between gap-5 p-5" style={stagger(0)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Disponibilidade agora</p>
            <p className="mt-1 text-5xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
              {availability}
              <span className="text-3xl text-subtle">%</span>
            </p>
            <p className="mt-2 text-xs text-subtle">
              {online} de {monitored} monitorados respondendo
            </p>
          </div>
          <div className="h-16 w-32 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.signal} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={chart.signal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="uptime" stroke={chart.signal} strokeWidth={1.5} fill="url(#uptimeGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <FleetStrip devices={devices} />
      </Card>

      <div className="reveal" style={stagger(1)}>
        <StatTile className="h-full" label="Online" tone="ok" value={online} hint={`${availability}% do total`} icon={<Check />} />
      </div>

      <div className="reveal" style={stagger(2)}>
        <StatTile
          className={cn('h-full', hasOffline && 'border-bad/50 bg-bad/5')}
          label="Offline"
          tone={hasOffline ? 'bad' : 'neutral'}
          value={offline}
          hint={hasOffline ? 'Requer atenção' : 'Nenhum equipamento fora'}
          icon={<X />}
        />
      </div>

      <div className="reveal" style={stagger(3)}>
        <StatTile
          className="h-full"
          label="Latência média"
          value={hasLatency(avgLatency) ? `${avgLatency < 10 ? avgLatency.toFixed(1) : Math.round(avgLatency)}ms` : '—'}
          hint={
            latencyTrend.value > 0 && latencyTrend.direction !== 'stable' ? (
              <span className={latencyTrend.direction === 'down' ? 'text-ok' : 'text-bad'}>
                {latencyTrend.direction === 'down' ? '↓' : '↑'} {latencyTrend.value}ms ({latencyTrend.percentage}%)
              </span>
            ) : (
              'Estável'
            )
          }
          icon={<Zap />}
        />
      </div>

      <div className="reveal" style={stagger(4)}>
        <StatTile className="h-full" label="Total de ativos" value={totalDevices} hint="Em monitoramento" icon={<Server />} />
      </div>
    </div>
  );
}
