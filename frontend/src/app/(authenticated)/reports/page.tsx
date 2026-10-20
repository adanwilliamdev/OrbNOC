'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, BarChart3, Printer } from 'lucide-react';
import { StatTile } from '@/components/ui/stat';
import { chart, tooltipLabelStyle, tooltipStyle } from '@/lib/theme';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportSummary, useUptimeSeries } from '@/hooks/use-alerts';
import { useDevices } from '@/hooks/use-devices';
import { pct } from '@/lib/format';
import SlaTable from '@/components/reports/SlaTable';
import { formatMs } from '@/lib/latency';
import type { SlaWindow } from '@/types/dashboard';

const WINDOWS: { value: SlaWindow; label: string; hours: number }[] = [
  { value: '24h', label: 'Últimas 24 horas', hours: 24 },
  { value: '7d', label: 'Últimos 7 dias', hours: 168 },
  { value: '30d', label: 'Últimos 30 dias', hours: 720 },
];


export default function ReportsPage() {
  const [window, setWindow] = useState<SlaWindow>('7d');
  const hours = WINDOWS.find((w) => w.value === window)?.hours ?? 168;
  const { stats } = useDevices();
  const summary = useReportSummary(window);
  const series = useUptimeSeries(hours);

  const points = useMemo(
    () =>
      (series.data ?? []).map((p) => ({
        time: new Date(p.timestamp).toLocaleString([], hours <= 24 ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit' }),
        uptime: p.uptime,
        latency: p.avgLatency,
      })),
    [series.data, hours],
  );
  const rows = summary.data?.devices ?? [];
  const pieData = [
    { name: 'Online', value: stats.online, color: chart.ok },
    { name: 'Offline', value: stats.offline, color: chart.bad },
  ];
  const exportUrl = (format: 'csv' | 'xlsx') => `/api/reports/export?format=${format}&window=${window}`;

  return (
    <PageShell
      title="Relatórios"
      subtitle="SLA calculado por janela de tempo, gerado no servidor"
      icon={<BarChart3 />}
      actions={
        <>
          <Select value={window} onValueChange={(v) => setWindow(v as SlaWindow)}>
            <SelectTrigger aria-label="Janela do relatório" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline">
            <a href={exportUrl('xlsx')} download>
              <Download /> Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={exportUrl('csv')} download>
              <Download /> CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/reports/print?window=${window}`}>
              <Printer /> PDF
            </Link>
          </Button>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total de dispositivos" value={String(summary.data?.total_devices ?? stats.total)} />
        <StatTile label={`Uptime (${window})`} value={pct(summary.data?.average_uptime_pct ?? null)} tone="ok" />
        <StatTile label="Latência média agora" value={formatMs(stats.avgLatency)} />
        <StatTile label="Offline agora" value={String(stats.offline)} tone={stats.offline > 0 ? 'bad' : 'neutral'} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartBox title="Distribuição de status">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
              {pieData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: chart.label, fontSize: 12 }} />
          </PieChart>
        </ChartBox>
        <ChartBox title="Histórico de disponibilidade" empty={points.length === 0}>
          <LineChart data={points}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Line type="monotone" dataKey="uptime" name="Uptime" stroke={chart.signal} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>

      <div className="mb-6">
        <ChartBox title="Evolução da latência média" empty={points.length === 0}>
          <LineChart data={points}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} unit="ms" />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Line type="monotone" dataKey="latency" name="Latência" stroke={chart.signal} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>

      <SlaTable rows={rows} window={window} loading={summary.isLoading} />
    </PageShell>
  );
}

function ChartBox({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-subtle">Ainda sem dados nesta janela</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
