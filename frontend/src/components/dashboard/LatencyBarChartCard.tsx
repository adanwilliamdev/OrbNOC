'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { BarChartDatum } from '@/types/dashboard';
import { getLatencyChartColor } from '@/lib/latency';

interface LatencyBarChartCardProps {
  barChartData: BarChartDatum[];
  hasOnlineDevices: boolean;
  onTestAll: () => void;
}

export default function LatencyBarChartCard({ barChartData, hasOnlineDevices, onTestAll }: LatencyBarChartCardProps) {
  const hasBarData = Array.isArray(barChartData) && barChartData.length > 0;

  return (
    <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="w-1 h-5 bg-[#4F8CFF] rounded-full"></span>
          Latência em Tempo Real
        </h3>
        <button onClick={onTestAll} className="px-2 py-1 bg-blue-600/20 hover:bg-[#4F8CFF] text-blue-300 hover:text-white rounded text-xs transition-all">
          Testar Todos
        </button>
      </div>

      {hasBarData && (
        <div className="flex items-center gap-4 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Média:</span>
            <span className="text-yellow-300 font-mono">
              {Math.round(barChartData.reduce((acc, d) => acc + d.latency, 0) / barChartData.length)}ms
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Máxima:</span>
            <span className="text-rose-400 font-mono">
              {Math.max(...barChartData.map((d) => d.latency))}ms
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Mínima:</span>
            <span className="text-emerald-300 font-mono">
              {Math.min(...barChartData.map((d) => d.latency))}ms
            </span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-slate-400">📊 {barChartData.length} dispositivos</span>
          </div>
        </div>
      )}

      {hasBarData ? (
        <div className="h-80 w-full" style={{ minHeight: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={barChartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              barCategoryGap={8} // Mais espaçamento entre as barras
            >
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
              <YAxis
                type="category"
                dataKey="name"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                width={90}
                tick={{ fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  border: '1px solid #1e293b',
                  color: '#e2e8f0',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                formatter={((value: number | string | undefined) => {
                  if (value === undefined || value === null) return ['N/A', 'Latência'];
                  return [`${value}ms`, 'Latência'];
                }) as any}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0]?.payload?.fullName) {
                    return `Dispositivo: ${payload[0].payload.fullName}`;
                  }
                  return `Dispositivo: ${label || 'Desconhecido'}`;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                verticalAlign="bottom"
                height={25}
                {...({
                  payload: [
                    { value: '🟢 < 50ms', type: 'circle', color: '#34d399' },
                    { value: '🟡 50-100ms', type: 'circle', color: '#f59e0b' },
                    { value: '🔴 > 100ms', type: 'circle', color: '#ef4444' },
                  ],
                } as any)}
              />
              <Bar
                dataKey="latency"
                radius={[0, 6, 6, 0]}
                barSize={20} // Barras um pouco mais grossas
                animationDuration={500}
                animationEasing="ease-out"
              >
                {barChartData.map((entry, index) => {
                  const color = getLatencyChartColor(entry.latency);
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 flex items-center justify-center text-slate-500 text-sm" style={{ minHeight: '320px' }}>
          {hasOnlineDevices ? 'Aguardando dados de latência...' : 'Nenhum dispositivo online'}
        </div>
      )}
    </div>
  );
}
