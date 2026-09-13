'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { StatusDatum } from '@/types/dashboard';

interface StatusPieCardProps {
  statusData: StatusDatum[];
}

export default function StatusPieCard({ statusData }: StatusPieCardProps) {
  return (
    <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-yellow-500 rounded-full"></span>Distribuição
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
              <Cell fill="#10b981" />
              <Cell fill="#ef4444" />
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} verticalAlign="bottom" height={30} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
