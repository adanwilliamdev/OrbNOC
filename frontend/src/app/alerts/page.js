'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AlertsCenter() {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ critical: 0, warning: 0, info: 0, recovery: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    loadAlerts();
  }, []);

  const loadAlerts = () => {
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}')?.id;
      const savedAlerts = localStorage.getItem(`orbnoc_alert_history_${userId}`);
      if (savedAlerts) {
        const parsed = JSON.parse(savedAlerts);
        setAlerts(parsed);
        calculateStats(parsed);
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const calculateStats = (alertsList) => {
    const critical = alertsList.filter(a => a.type === 'error' || a.type === 'critical').length;
    const warning = alertsList.filter(a => a.type === 'warning').length;
    const info = alertsList.filter(a => a.type === 'success' || a.type === 'info').length;
    const recovery = alertsList.filter(a => a.message.includes('Host Up') || a.message.includes('online')).length;
    setStats({ critical, warning, info, recovery });
  };

  const getAlertIcon = (type) => {
    if (type === 'error' || type === 'critical') return '🔴';
    if (type === 'warning') return '🟠';
    return '🟢';
  };

  const getAlertTitle = (type) => {
    if (type === 'error' || type === 'critical') return 'CRÍTICO';
    if (type === 'warning') return 'ALERTA';
    return 'INFO';
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'critical') return alert.type === 'error' || alert.type === 'critical';
    if (filter === 'warning') return alert.type === 'warning';
    if (filter === 'recovery') return alert.message.includes('Host Up') || alert.message.includes('online');
    if (filter === 'info') return alert.type === 'success' || alert.type === 'info';
    return true;
  });

  const chartData = alerts.slice(0, 20).reverse().map(alert => ({
    time: alert.timestamp,
    severity: alert.type === 'error' ? 3 : alert.type === 'warning' ? 2 : 1
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" /><p className="text-slate-400 mt-3 text-sm">Carregando alertas...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
              <span className="text-3xl">🚨</span> Centro de Alertas
            </h1>
            <p className="text-sm text-slate-500 mt-1">Monitoramento de incidentes em tempo real</p>
          </div>
          <button onClick={() => router.push('/')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-all border border-slate-700 text-slate-400 hover:text-white">← Voltar</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-rose-500/20 rounded-xl p-4 hover:border-rose-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">🔴</span><span className="text-2xl font-bold text-rose-400">{stats.critical}</span></div><p className="text-sm font-medium text-rose-400 mt-1">Alertas Críticos</p><p className="text-[10px] text-slate-500 mt-1">Requer ação imediata</p></div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-amber-500/20 rounded-xl p-4 hover:border-amber-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">🟠</span><span className="text-2xl font-bold text-amber-400">{stats.warning}</span></div><p className="text-sm font-medium text-amber-400 mt-1">Alertas de Atenção</p><p className="text-[10px] text-slate-500 mt-1">Monitorar de perto</p></div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-emerald-500/20 rounded-xl p-4 hover:border-emerald-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">🟢</span><span className="text-2xl font-bold text-emerald-400">{stats.recovery}</span></div><p className="text-sm font-medium text-emerald-400 mt-1">Recuperações</p><p className="text-[10px] text-slate-500 mt-1">Hosts restaurados</p></div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-all"><div className="flex items-center justify-between"><span className="text-2xl">ℹ️</span><span className="text-2xl font-bold text-blue-400">{stats.info}</span></div><p className="text-sm font-medium text-blue-400 mt-1">Informações</p><p className="text-[10px] text-slate-500 mt-1">Eventos normais</p></div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><span className="w-1 h-4 bg-gradient-to-b from-rose-500 to-amber-500 rounded-full"></span>Tendência de Alertas</h3>
            <div className="h-32"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} /><Area type="monotone" dataKey="severity" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Todos</button>
          <button onClick={() => setFilter('critical')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'critical' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🔴 Críticos</button>
          <button onClick={() => setFilter('warning')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🟠 Atenção</button>
          <button onClick={() => setFilter('recovery')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'recovery' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🟢 Recuperações</button>
          <button onClick={() => setFilter('info')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'info' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>ℹ️ Informações</button>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-12 text-center"><span className="text-4xl mb-3 block">✅</span><p className="text-slate-400">Nenhum alerta registrado</p></div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.slice(0, 50).map((alert, idx) => (
              <div key={idx} className={`p-4 rounded-xl border transition-all hover:scale-[1.01] ${alert.type === 'error' || alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50' : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'}`}>
                <div className="flex items-start gap-3"><span className="text-xl">{getAlertIcon(alert.type)}</span><div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className={`text-xs font-bold px-2 py-0.5 rounded ${alert.type === 'error' || alert.type === 'critical' ? 'bg-rose-500/20 text-rose-400' : alert.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{getAlertTitle(alert.type)}</span><span className="text-xs text-slate-500">{alert.timestamp}</span></div><p className="text-slate-200 mt-2">{alert.message}</p></div></div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-8 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
          OrbNOC Network Operations Center © 2026 • Desenvolvido por <span className="text-blue-400">Adan W O Santos</span>
        </footer>
      </div>
    </div>
  );
}