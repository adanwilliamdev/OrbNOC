'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMs, getLatencyChartColor } from '@/lib/latency';
import { chart, tooltipLabelStyle, tooltipStyle } from '@/lib/theme';
import type { BarChartDatum } from '@/types/dashboard';

interface LatencyBarChartCardProps {
  barChartData: BarChartDatum[];
  hasOnlineDevices: boolean;
  testing?: boolean;
  onTestAll: () => void;
}

const LEGEND = [
  { color: 'bg-ok', label: 'Até 50ms' },
  { color: 'bg-warn', label: '50 a 100ms' },
  { color: 'bg-bad', label: 'Acima de 100ms' },
];

export default function LatencyBarChartCard({ barChartData, hasOnlineDevices, testing = false, onTestAll }: LatencyBarChartCardProps) {
  const hasData = barChartData.length > 0;
  const latencies = barChartData.map((d) => d.latency);
  const stats = hasData
    ? [
        { label: 'Média', value: formatMs(latencies.reduce((a, b) => a + b, 0) / latencies.length) },
        { label: 'Mínima', value: formatMs(Math.min(...latencies)) },
        { label: 'Máxima', value: formatMs(Math.max(...latencies)) },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Latência em tempo real</CardTitle>
          <CardDescription>{hasData ? `${barChartData.length} dispositivos respondendo` : 'Aguardando medições'}</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={onTestAll} disabled={testing}>
          <Zap /> {testing ? 'Testando...' : 'Testar todos'}
        </Button>
      </CardHeader>
      <div className="px-5 pb-5">
        {hasData && (
          <dl className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dt className="text-subtle">{s.label}</dt>
                <dd className="font-mono text-sm text-foreground tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {hasData ? (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={barChartData} margin={{ top: 6, right: 16, left: 4, bottom: 6 }} barCategoryGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                  <XAxis type="number" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} domain={[0, 'dataMax + 10']} tickFormatter={(value) => `${value}ms`} />
                  <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={96} tick={{ fill: chart.label }} />
                  <Tooltip
                    cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value) => [formatMs(Number(value)), 'Latência']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label ?? 'Desconhecido'}
                  />
                  <Bar dataKey="latency" radius={[0, 6, 6, 0]} barSize={18} animationDuration={500}>
                    {barChartData.map((entry) => (
                      <Cell key={entry.id} fill={getLatencyChartColor(entry.latency)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-subtle">
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${l.color}`} />
                  {l.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-subtle">{hasOnlineDevices ? 'Aguardando dados de latência...' : 'Nenhum dispositivo online'}</div>
        )}
      </div>
    </Card>
  );
}
