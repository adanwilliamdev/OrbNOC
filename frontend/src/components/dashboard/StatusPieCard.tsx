'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import type { StatusDatum } from '@/types/dashboard';

export default function StatusPieCard({ statusData }: { statusData: StatusDatum[] }) {
  return (
    <Card>
      <CardContent>
        <CardTitle className="mb-3">
          <span className="h-5 w-1 rounded-full bg-yellow-500" />
          Distribuição
        </CardTitle>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
                {statusData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
              <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
