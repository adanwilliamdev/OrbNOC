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
    addAlert('Alerta reconhecido', 'info');
  };

  const addAlert = (message, type) => {
    const newAlert = { id: Date.now(), message, type, timestamp: new Date().toLocaleTimeString() };
    setAlerts(prev => [newAlert, ...prev]);
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

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'agora';
    const [time] = timestamp.split(' ');
    return `há ${time}`;
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'critical') return alert.type === 'error' || alert.type === 'critical';
    if (filter === 'warning') return alert.type === 'warning';
    if (filter === 'recovery') return alert.message.includes('Host Up') || alert.message.includes('online');
    if (filter === 'info') return alert.type === 'success' || alert.type === 'info';
    return true;
  });

  // Dados para gráfico de tendência de alertas
  const chartData = alerts.slice(0, 20).reverse().map((alert, idx) => ({
    time: alert.timestamp,
    severity: alert.type === 'error' ? 3 : alert.type === 'warning' ? 2 : 1
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
              🚨 Centro de Alertas
            </h1>
            <p className="text-sm text-slate-500 mt-1">Monitoramento de incidentes em tempo real</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setTimeRange('1h')}
              className={`px-3 py-1.5 rounded-md text-xs transition-all ${timeRange === '1h' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              1h
            </button>
            <button
              onClick={() => setTimeRange('24h')}
              className={`px-3 py-1.5 rounded-md text-xs transition-all ${timeRange === '24h' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              24h
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-md text-xs transition-all ${timeRange === '7d' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              7d
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-all ml-2"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 hover:border-rose-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🔴</span>
              <span className="text-2xl font-bold text-rose-400">{stats.critical}</span>
            </div>
            <p className="text-sm font-medium text-rose-400 mt-1">Alertas Críticos</p>
            <p className="text-[10px] text-slate-500 mt-1">Requer ação imediata</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🟠</span>
              <span className="text-2xl font-bold text-amber-400">{stats.warning}</span>
            </div>
            <p className="text-sm font-medium text-amber-400 mt-1">Alertas de Atenção</p>
            <p className="text-[10px] text-slate-500 mt-1">Monitorar de perto</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🟢</span>
              <span className="text-2xl font-bold text-emerald-400">{stats.recovery}</span>
            </div>
            <p className="text-sm font-medium text-emerald-400 mt-1">Recuperações</p>
            <p className="text-[10px] text-slate-500 mt-1">Hosts restaurados</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-2xl">ℹ️</span>
              <span className="text-2xl font-bold text-blue-400">{stats.info}</span>
            </div>
            <p className="text-sm font-medium text-blue-400 mt-1">Informações</p>
            <p className="text-[10px] text-slate-500 mt-1">Eventos normais</p>
          </div>
        </div>

        {/* Trend Chart */}
        {chartData.length > 0 && (
          <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-rose-500 to-amber-500 rounded-full"></span>
              Tendência de Alertas
            </h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
                  <Area type="monotone" dataKey="severity" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'critical' ? 'bg-rose-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}
          >
            🔴 Críticos
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}
          >
            🟠 Atenção
          </button>
          <button
            onClick={() => setFilter('recovery')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'recovery' ? 'bg-emerald-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}
          >
            🟢 Recuperações
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'info' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}
          >
            ℹ️ Informações
          </button>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-12 text-center">
            <span className="text-4xl mb-3 block">✅</span>
            <p className="text-slate-400">Nenhum alerta registrado</p>
            <p className="text-xs text-slate-500 mt-1">Os alertas aparecerão aqui quando houver incidentes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${
                  acknowledged.includes(alert.id) ? 'opacity-60' : ''
                } ${
                  alert.type === 'error' || alert.type === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
                    : alert.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                }`}
                onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getAlertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        alert.type === 'error' || alert.type === 'critical'
                          ? 'bg-rose-500/20 text-rose-400'
                          : alert.type === 'warning'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {getAlertTitle(alert.type)}
                      </span>
                      <span className="text-xs text-slate-500">{alert.timestamp}</span>
                      {!acknowledged.includes(alert.id) && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">
                          NOVO
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200 mt-2">{alert.message}</p>

                    {/* Expandable details */}
                    {selectedAlert === alert.id && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); acknowledgeAlert(alert.id); }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            ✓ Reconhecer
                          </button>
                          <button className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
                            📋 Copiar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}