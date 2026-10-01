'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { chart } from '@/lib/theme';
import type { HistoryEntry } from '@/types/dashboard';

/** `history` em ordem cronológica (mais antigo primeiro), como vem do servidor. */
export default function UptimeHistoryCard({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  const current = history[history.length - 1]?.uptime ?? 100;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Disponibilidade nas últimas 24h</CardTitle>
          <CardDescription>Média por hora, de todos os dispositivos</CardDescription>
        </div>
        <p className="text-2xl font-semibold text-foreground tabular-nums">{current}%</p>
      </CardHeader>
      <div className="h-28 px-2 pb-3" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history.slice(-24)}>
            <defs>
              <linearGradient id="uptime24Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.signal} stopOpacity={0.22} />
                <stop offset="100%" stopColor={chart.signal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="uptime" stroke={chart.signal} strokeWidth={2} fill="url(#uptime24Gradient)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
