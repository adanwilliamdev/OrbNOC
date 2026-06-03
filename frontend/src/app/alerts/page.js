'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

export default function AlertsCenter() {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [stats, setStats] = useState({ critical: 0, warning: 0, info: 0, recovery: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [acknowledged, setAcknowledged] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const savedAlerts = localStorage.getItem('orbnoc_alert_history');
      if (savedAlerts) {
        const parsed = JSON.parse(savedAlerts);
        setAlerts(parsed);
        calculateStats(parsed);
      }
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (alertsList) => {
    const critical = alertsList.filter(a => a.type === 'error' || a.type === 'critical').length;
    const warning = alertsList.filter(a => a.type === 'warning').length;
    const info = alertsList.filter(a => a.type === 'success' || a.type === 'info').length;
    const recovery = alertsList.filter(a => a.message.includes('Host Up') || a.message.includes('online')).length;
    setStats({ critical, warning, info, recovery });
  };

  const acknowledgeAlert = (id) => {
    setAcknowledged(prev => [...prev, id]);
  };

  const getAlertIcon = (type) => {
    switch(type) {
      case 'error': return '🔴';
      case 'critical': return '🔴';
      case 'warning': return '🟠';
      default: return '🟢';
    }
  };

  const getAlertTitle = (type) => {
    switch(type) {
      case 'error': return 'CRÍTICO';
      case 'critical': return 'CRÍTICO';
      case 'warning': return 'ALERTA';
      default: return 'INFO';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'critical') return alert.type === 'error' || alert.type === 'critical';
    if (filter === 'warning') return alert.type === 'warning';
    if (filter === 'recovery') return alert.message.includes('Host Up') || alert.message.includes('online');
    if (filter === 'info') return alert.type === 'success' || alert.type === 'info';
    return true;
  });

  const chartData = alerts.slice(0, 20).reverse().map((alert, idx) => ({
    time: alert.timestamp,
    severity: alert.type === 'error' ? 3 : alert.type === 'warning' ? 2 : 1
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#0f0f1a] flex items-center justify-center">
        <div className="text-center"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" /><p className="text-slate-400 mt-3 text-sm">Carregando alertas...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f]">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">🚨 Centro de Alertas</h1>
            <p className="text-sm text-slate-500 mt-1">Monitoramento de incidentes em tempo real</p>
          </div>
          <div className="flex gap-3">
            {['1h', '24h', '7d'].map((range) => (
              <button key={range} onClick={() => setTimeRange(range)} className={`px-3 py-1.5 rounded-md text-xs transition-all ${timeRange === range ? 'bg-blue-600 text-white' : 'bg-[#0d1117] text-slate-400 border border-slate-700'}`}>{range}</button>
            ))}
            <button onClick={() => router.push('/')} className="px-3 py-2 bg-[#0d1117] hover:bg-[#1a1f2e] rounded-lg text-sm transition-all border border-slate-700">← Voltar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0e12] border border-rose-500/20 rounded-xl p-4 hover:border-rose-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">🔴</span><span className="text-2xl font-bold text-rose-400">{stats.critical}</span></div><p className="text-sm font-medium text-rose-400 mt-1">Alertas Críticos</p><p className="text-[10px] text-slate-500 mt-1">Requer ação imediata</p></div>
          <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0e12] border border-amber-500/20 rounded-xl p-4 hover:border-amber-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">🟠</span><span className="text-2xl font-bold text-amber-400">{stats.warning}</span></div><p className="text-sm font-medium text-amber-400 mt-1">Alertas de Atenção</p><p className="text-[10px] text-slate-500 mt-1">Monitorar de perto</p></div>
          <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0e12] border border-emerald-500/20 rounded-xl p-4 hover:border-emerald-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">🟢</span><span className="text-2xl font-bold text-emerald-400">{stats.recovery}</span></div><p className="text-sm font-medium text-emerald-400 mt-1">Recuperações</p><p className="text-[10px] text-slate-500 mt-1">Hosts restaurados</p></div>
          <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0e12] border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">ℹ️</span><span className="text-2xl font-bold text-blue-400">{stats.info}</span></div><p className="text-sm font-medium text-blue-400 mt-1">Informações</p><p className="text-[10px] text-slate-500 mt-1">Eventos normais</p></div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0e12] rounded-xl border border-slate-800 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><span className="w-1 h-4 bg-gradient-to-b from-rose-500 to-amber-500 rounded-full"></span>Tendência de Alertas</h3>
            <div className="h-32"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} /><Area type="monotone" dataKey="severity" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'critical', 'warning', 'recovery', 'info'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-blue-600 text-white' : 'bg-[#0d1117] text-slate-400 border border-slate-700 hover:bg-[#1a1f2e]'}`}>
              {f === 'all' ? 'Todos' : f === 'critical' ? '🔴 Críticos' : f === 'warning' ? '🟠 Atenção' : f === 'recovery' ? '🟢 Recuperações' : 'ℹ️ Informações'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-[#0d1117]/50 rounded-xl border border-slate-800 p-12 text-center"><span className="text-4xl mb-3 block">✅</span><p className="text-slate-400">Nenhum alerta registrado</p></div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert, idx) => (
              <div key={idx} onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)} className={`p-4 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${acknowledged.includes(alert.id) ? 'opacity-60' : ''} ${alert.type === 'error' || alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50' : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'}`}>
                <div className="flex items-start gap-3"><span className="text-xl">{getAlertIcon(alert.type)}</span><div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className={`text-xs font-bold px-2 py-0.5 rounded ${alert.type === 'error' || alert.type === 'critical' ? 'bg-rose-500/20 text-rose-400' : alert.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{getAlertTitle(alert.type)}</span><span className="text-xs text-slate-500">{alert.timestamp}</span>{!acknowledged.includes(alert.id) && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">NOVO</span>}</div><p className="text-slate-200 mt-2">{alert.message}</p></div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}