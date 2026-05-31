'use client';

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Gráfico de Linha - Histórico de Disponibilidade
export function LineChartComponent({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="online" stroke="#48bb78" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="offline" stroke="#f56565" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Gráfico de Barras - Status por Dispositivo
export function BarChartComponent({ devices }) {
  const data = [
    { name: 'Online', value: devices.filter(d => d.status === 'online').length, color: '#48bb78' },
    { name: 'Offline', value: devices.filter(d => d.status === 'offline').length, color: '#f56565' }
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#8884d8">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Gráfico de Pizza - Distribuição
export function PieChartComponent({ devices }) {
  const data = [
    { name: 'Online', value: devices.filter(d => d.status === 'online').length, color: '#48bb78' },
    { name: 'Offline', value: devices.filter(d => d.status === 'offline').length, color: '#f56565' }
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Gráfico de Gauge - Uptime
export function GaugeChart({ uptime }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={[
            { name: 'Uptime', value: uptime, color: '#48bb78' },
            { name: 'Downtime', value: 100 - uptime, color: '#f56565' }
          ]}
          cx="50%"
          cy="50%"
          startAngle={180}
          endAngle={0}
          innerRadius={80}
          outerRadius={120}
          paddingAngle={5}
          dataKey="value"
        >
          <Cell fill="#48bb78" />
          <Cell fill="#f56565" />
        </Pie>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="bold">
          {uptime}%
        </text>
        <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#718096">
          Uptime
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}