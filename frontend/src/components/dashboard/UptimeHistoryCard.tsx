'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import type { HistoryEntry } from '@/types/dashboard';

/** `history` em ordem cronológica (mais antigo primeiro), como vem do servidor. */
export default function UptimeHistoryCard({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  const current = history[history.length - 1]?.uptime ?? 100;

  return (
    <Card>
      <CardContent>
        <CardTitle className="mb-3">
          <span className="h-5 w-1 rounded-full bg-emerald-500" />
          Disponibilidade (Últimas 24h)
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-300">{current}%</p>
            <p className="mt-1 text-xs text-slate-400">Hora atual</p>
          </div>
          <div className="w-32" aria-hidden="true">
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={history.slice(-24)}>
                <Area type="monotone" dataKey="uptime" stroke="#10b981" strokeWidth={2} fill="none" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
