'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { tooltipStyle } from '@/lib/theme';
import type { StatusDatum } from '@/types/dashboard';

export default function StatusPieCard({ statusData }: { statusData: StatusDatum[] }) {
  const total = statusData.reduce((sum, d) => sum + d.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição</CardTitle>
      </CardHeader>
      <div className="flex items-center gap-5 px-5 pb-5">
        <div className="relative size-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none">
                {statusData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl leading-none font-semibold text-foreground tabular-nums">{total}</span>
            <span className="mt-1 text-[11px] text-subtle">ativos</span>
          </div>
        </div>
        <ul className="flex-1 space-y-2 text-sm">
          {statusData.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </span>
              <span className="font-medium text-foreground tabular-nums">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
