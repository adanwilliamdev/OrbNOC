'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

export default function ReportsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const devicesRes = await fetch(`${API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (devicesRes.ok) setDevices(await devicesRes.json());
      const userId = JSON.parse(localStorage.getItem('user') || '{}')?.id;
      const savedHistory = localStorage.getItem(`orbnoc_history_${userId}`);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const getFilteredHistory = () => {
    let filtered = [...history];
    if (dateRange === '24h') filtered = filtered.slice(0, 24);
    else if (dateRange === '7d') filtered = filtered.slice(0, 168);
    else if (dateRange === '30d') filtered = filtered.slice(0, 720);
    return filtered.reverse();
  };

  const exportToExcel = () => {
    const data = devices.map(d => ({
      Nome: d.name,
      IP: d.ip,
      Status: d.status === 'online' ? 'Online' : 'Offline',
      Latência: d.latency ? `${d.latency}ms` : '—',
      'Perda Pacotes': d.packet_loss ? `${d.packet_loss}%` : '0%',
      Localização: d.location || '—'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispositivos');
    XLSX.writeFile(wb, `orbnoc-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const availability = devices.length ? Math.round((online / devices.length) * 100) : 0;
  const avgLatency = devices.filter(d => d.status === 'online' && d.latency).length > 0
    ? Math.round(devices.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + d.latency, 0) / devices.filter(d => d.status === 'online' && d.latency).length)
    : 0;
  const pieData = [
    { name: 'Online', value: online, color: '#10b981' },
    { name: 'Offline', value: offline, color: '#ef4444' }
  ];
  const filteredHistory = getFilteredHistory();
  const uptimeData = filteredHistory.map(h => ({
    date: h.timestamp?.split(' ')[0] || h.timestamp?.split(',')[0] || '',
    uptime: h.uptime || 0
  })).slice(-30);
  const latencyData = filteredHistory.map(h => ({
    date: h.timestamp?.split(' ')[0] || '',
    latency: h.avgLatency || 0
  })).slice(-30);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-3 text-sm">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <span className="text-3xl">📊</span> Relatórios
            </h1>
            <p className="text-sm text-slate-500 mt-1">Geração de relatórios e análise de dados</p>
          </div>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-200"
            >
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
            <button
              onClick={exportToExcel}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-sm transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Exportar Excel
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-all border border-slate-700 text-slate-400 hover:text-white flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Dispositivos</p>
            <p className="text-2xl font-bold text-white">{devices.length}</p>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Disponibilidade</p>
            <p className="text-2xl font-bold text-emerald-400">{availability}%</p>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Latência Média</p>
            <p className="text-2xl font-bold text-amber-400">{avgLatency}ms</p>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Dispositivos Offline</p>
            <p className="text-2xl font-bold text-rose-400">{offline}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              Distribuição de Status
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value" label>
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                  <Legend wrapperStyle={{ color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
              Histórico de Disponibilidade
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={uptimeData}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="uptime" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Latency Chart */}
        {latencyData.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
              Evolução da Latência Média
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Device Table */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
              Lista de Dispositivos Monitorados
            </h3>
            <p className="text-xs text-slate-500 mt-1">Total de {devices.length} dispositivos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Latência</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Perda</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Localização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${device.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {device.status === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">{device.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{device.ip}</td>
                    <td className="px-4 py-3 text-slate-300">{device.latency ? `${device.latency}ms` : '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{device.packet_loss ? `${device.packet_loss}%` : '0%'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{device.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
          Relatório gerado em {new Date().toLocaleString()} • OrbNOC Network Operations Center © 2026 • Desenvolvido por <span className="text-blue-400 hover:text-blue-300 transition-colors">Adan W O Santos</span>
        </footer>
      </div>
    </div>
  );
}