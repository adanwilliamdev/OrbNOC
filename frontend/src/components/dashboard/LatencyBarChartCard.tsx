'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMs, getLatencyChartColor } from '@/lib/latency';
import type { BarChartDatum } from '@/types/dashboard';

interface LatencyBarChartCardProps {
  barChartData: BarChartDatum[];
  hasOnlineDevices: boolean;
  testing?: boolean;
  onTestAll: () => void;
}

export default function LatencyBarChartCard({ barChartData, hasOnlineDevices, testing = false, onTestAll }: LatencyBarChartCardProps) {
  const hasData = barChartData.length > 0;
  const latencies = barChartData.map((d) => d.latency);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="h-5 w-1 rounded-full bg-primary" />
          Latência em Tempo Real
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onTestAll} disabled={testing} className="h-7 bg-blue-600/20 text-blue-300 hover:bg-primary hover:text-white">
          {testing ? 'Testando...' : 'Testar Todos'}
        </Button>
      </CardHeader>
      <div className="p-4 pt-3">
        {hasData && (
          <div className="mb-3 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Média:</span>
              <span className="font-mono text-yellow-300">{formatMs(latencies.reduce((a, b) => a + b, 0) / latencies.length)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Máxima:</span>
              <span className="font-mono text-rose-400">{formatMs(Math.max(...latencies))}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Mínima:</span>
              <span className="font-mono text-emerald-300">{formatMs(Math.min(...latencies))}</span>
            </div>
            <div className="ml-auto text-slate-400">📊 {barChartData.length} dispositivos</div>
          </div>
        )}

        {hasData ? (
          <div className="w-full">
            <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={barChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }} barCategoryGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                  domain={[0, 'dataMax + 10']}
                  tickFormatter={(value) => `${value}ms`}
                />
                <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} width={90} tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                  formatter={(value) => [formatMs(Number(value)), 'Latência']}
                  labelFormatter={(label, payload) => `Dispositivo: ${payload?.[0]?.payload?.fullName ?? label ?? 'Desconhecido'}`}
                />
                <Bar dataKey="latency" radius={[0, 6, 6, 0]} barSize={20} animationDuration={500}>
                  {barChartData.map((entry) => (
                    <Cell key={entry.id} fill={getLatencyChartColor(entry.latency)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
            <div className="mt-1 flex justify-center gap-4 text-[10px] text-slate-400">
              <span>🟢 &lt; 50ms</span>
              <span>🟡 50-100ms</span>
              <span>🔴 &gt; 100ms</span>
            </div>
          </div>
        ) : (
          <div className="flex h-80 items-center justify-center text-sm text-slate-500">
            {hasOnlineDevices ? 'Aguardando dados de latência...' : 'Nenhum dispositivo online'}
          </div>
        )}
      </div>
    </Card>
  );
}
