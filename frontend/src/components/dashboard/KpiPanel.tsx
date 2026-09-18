'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { HistoryEntry, LatencyTrend } from '@/types/dashboard';

interface KpiPanelProps {
  totalDevices: number;
  online: number;
  offline: number;
  availability: number;
  avgLatency: number;
  latencyTrend: LatencyTrend;
  history: HistoryEntry[];
}

export default function KpiPanel({
  totalDevices,
  online,
  offline,
  availability,
  avgLatency,
  latencyTrend,
  history,
}: KpiPanelProps) {
  const hasOfflineDevices = offline > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4 hover:border-slate-500 transition-all">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Ativos</p>
            <p className="text-2xl font-semibold mt-1 text-white">{totalDevices}</p>
          </div>
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-emerald-800/30 hover:border-emerald-500/50 transition-all p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-emerald-300/80 uppercase tracking-wider">Online</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-300">{online}</p>
            <p className="text-[10px] text-emerald-500/60 mt-1">{availability}% do total</p>
          </div>
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>
      </div>

      <div className={`bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border transition-all p-4 ${hasOfflineDevices ? 'border-rose-500/50 animate-pulse-slow' : 'border-rose-800/30 hover:border-rose-500/30'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-rose-400/80 uppercase tracking-wider">Offline</p>
            <p className={`text-2xl font-semibold mt-1 ${hasOfflineDevices ? 'text-rose-500' : 'text-rose-400'}`}>{offline}</p>
            {hasOfflineDevices && <p className="text-[10px] text-rose-500/60 mt-1 animate-pulse">⚠️ Atenção!</p>}
          </div>
          <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4 hover:border-slate-500 transition-all">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Disponibilidade</p>
            <p className="text-2xl font-semibold mt-1 text-blue-300">{availability}%</p>
            <p className="text-[10px] text-slate-500 mt-1">SLA</p>
          </div>
          <div className="w-12 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history.slice(0, 20).reverse()}>
                <Area type="monotone" dataKey="uptime" stroke="#3b82f6" strokeWidth={1} fill="url(#uptimeGradient)" />
                <defs>
                  <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4 hover:border-slate-500 transition-all">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Latência Média</p>
            <p className="text-2xl font-semibold mt-1 text-yellow-300">{avgLatency ? `${Math.round(avgLatency)}ms` : '—'}</p>
            {latencyTrend.value > 0 && latencyTrend.direction !== 'stable' && (
              <div className={`flex items-center gap-1 mt-1 text-[10px] ${latencyTrend.direction === 'down' ? 'text-emerald-300' : 'text-rose-400'}`}>
                {latencyTrend.direction === 'down' ? '↓' : '↑'} {latencyTrend.value}ms ({latencyTrend.percentage}%)
              </div>
            )}
          </div>
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
