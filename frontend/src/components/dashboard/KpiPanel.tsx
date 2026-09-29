'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Check, Server, X, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { hasLatency } from '@/lib/latency';
import type { HistoryEntry, LatencyTrend } from '@/types/dashboard';

interface KpiPanelProps {
  totalDevices: number;
  online: number;
  offline: number;
  availability: number;
  avgLatency: number | null;
  latencyTrend: LatencyTrend;
  /** Série cronológica (mais antigo primeiro). */
  history: HistoryEntry[];
}

export default function KpiPanel({ totalDevices, online, offline, availability, avgLatency, latencyTrend, history }: KpiPanelProps) {
  const hasOffline = offline > 0;
  const sparkline = history.slice(-20);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card className="p-4 transition-all hover:border-slate-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider text-slate-400 uppercase">Total Ativos</p>
            <p className="mt-1 text-2xl font-semibold text-white">{totalDevices}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Server className="size-4 text-blue-300" />
          </div>
        </div>
      </Card>

      <Card className="border-emerald-800/30 p-4 transition-all hover:border-emerald-500/50">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider text-emerald-300/80 uppercase">Online</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{online}</p>
            <p className="mt-1 text-[10px] text-emerald-500/60">{availability}% do total</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Check className="size-4 text-emerald-300" />
          </div>
        </div>
      </Card>

      <Card className={`p-4 transition-all ${hasOffline ? 'animate-pulse-slow border-rose-500/50' : 'border-rose-800/30 hover:border-rose-500/30'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider text-rose-400/80 uppercase">Offline</p>
            <p className={`mt-1 text-2xl font-semibold ${hasOffline ? 'text-rose-500' : 'text-rose-400'}`}>{offline}</p>
            {hasOffline && <p className="mt-1 animate-pulse text-[10px] text-rose-500/60">⚠️ Atenção!</p>}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
            <X className="size-4 text-rose-400" />
          </div>
        </div>
      </Card>

      <Card className="p-4 transition-all hover:border-slate-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider text-slate-400 uppercase">Disponibilidade</p>
            <p className="mt-1 text-2xl font-semibold text-blue-300">{availability}%</p>
            <p className="mt-1 text-[10px] text-slate-500">Agora</p>
          </div>
          <div className="h-8 w-12" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="uptime" stroke="#3b82f6" strokeWidth={1} fill="url(#uptimeGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card className="p-4 transition-all hover:border-slate-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider text-slate-400 uppercase">Latência Média</p>
            <p className="mt-1 text-2xl font-semibold text-yellow-300">{hasLatency(avgLatency) ? `${avgLatency < 10 ? avgLatency.toFixed(1) : Math.round(avgLatency)}ms` : '—'}</p>
            {latencyTrend.value > 0 && latencyTrend.direction !== 'stable' && (
              <div className={`mt-1 flex items-center gap-1 text-[10px] ${latencyTrend.direction === 'down' ? 'text-emerald-300' : 'text-rose-400'}`}>
                {latencyTrend.direction === 'down' ? '↓' : '↑'} {latencyTrend.value}ms ({latencyTrend.percentage}%)
              </div>
            )}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Zap className="size-4 text-yellow-300" />
          </div>
        </div>
      </Card>
    </div>
  );
}
