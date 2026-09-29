'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Printer } from 'lucide-react';
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

const TOOLTIP = { backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' };


export default function ReportsPage() {
  const [window, setWindow] = useState<SlaWindow>('7d');
  const hours = WINDOWS.find((w) => w.value === window)?.hours ?? 168;
  const { stats } = useDevices();
  const summary = useReportSummary(window);
  const series = useUptimeSeries(hours);

  const chart = useMemo(
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
    { name: 'Online', value: stats.online, color: '#10b981' },
    { name: 'Offline', value: stats.offline, color: '#ef4444' },
  ];
  const exportUrl = (format: 'csv' | 'xlsx') => `/api/reports/export?format=${format}&window=${window}`;

  return (
    <PageShell
      title="Relatórios"
      subtitle="SLA calculado por janela de tempo, gerado no servidor"
      icon="📊"
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
        <Kpi label="Total Dispositivos" value={String(summary.data?.total_devices ?? stats.total)} color="text-white" />
        <Kpi label={`Uptime (${window})`} value={pct(summary.data?.average_uptime_pct ?? null)} color="text-emerald-400" />
        <Kpi label="Latência Média Agora" value={formatMs(stats.avgLatency)} color="text-amber-400" />
        <Kpi label="Offline Agora" value={String(stats.offline)} color="text-rose-400" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartBox title="Distribuição de Status" bar="bg-blue-500">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value" label>
              {pieData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />
          </PieChart>
        </ChartBox>
        <ChartBox title="Histórico de Disponibilidade" bar="bg-emerald-500" empty={chart.length === 0}>
          <LineChart data={chart}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} minTickGap={32} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={TOOLTIP} />
            <Line type="monotone" dataKey="uptime" name="Uptime" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>

      <div className="mb-6">
        <ChartBox title="Evolução da Latência Média" bar="bg-amber-500" empty={chart.length === 0}>
          <LineChart data={chart}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} minTickGap={32} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="ms" />
            <Tooltip contentStyle={TOOLTIP} />
            <Line type="monotone" dataKey="latency" name="Latência" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>

      <SlaTable rows={rows} window={window} loading={summary.isLoading} />
    </PageShell>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4">
      <p className="text-xs tracking-wider text-slate-500 uppercase">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ChartBox({ title, bar, empty, children }: { title: string; bar: string; empty?: boolean; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <span className={`h-4 w-1 rounded-full ${bar}`} />
        {title}
      </h2>
      <div className="h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Ainda sem dados nesta janela</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
