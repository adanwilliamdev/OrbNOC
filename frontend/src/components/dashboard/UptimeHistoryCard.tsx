'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { HistoryEntry } from '@/types/dashboard';

interface UptimeHistoryCardProps {
  history: HistoryEntry[];
}

export default function UptimeHistoryCard({ history }: UptimeHistoryCardProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>Disponibilidade (Últimas 24h)
      </h3>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <p className="text-3xl font-bold text-emerald-300">{history[0]?.uptime || 100}%</p>
          <p className="text-xs text-slate-400 mt-1">SLA Atual</p>
        </div>
        <div className="w-32">
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={history.slice(0, 24).reverse()}>
              <Area type="monotone" dataKey="uptime" stroke="#10b981" strokeWidth={2} fill="none" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
