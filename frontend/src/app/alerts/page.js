'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

export default function AlertsCenter() {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

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
        setAlerts(parsed.slice(0, 100));
      }
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type) => {
    switch(type) {
      case 'error': return '🔴';
      case 'warning': return '🟠';
      case 'critical': return '🔴';
      default: return '🟢';
    }
  };

  const getAlertTitle = (type) => {
    switch(type) {
      case 'error': return 'CRÍTICO';
      case 'warning': return 'ALERTA';
      case 'critical': return 'CRÍTICO';
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
    return true;
  });

  const criticalCount = alerts.filter(a => a.type === 'error' || a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
              Centro de Alertas
            </h1>
            <p className="text-sm text-slate-500 mt-1">Monitoramento de incidentes em tempo real</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl text-sm transition-all"
          >
            ← Voltar ao Dashboard
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🔴</span>
              <span className="text-2xl font-bold text-rose-400">{criticalCount}</span>
            </div>
            <p className="text-sm font-medium text-rose-400 mt-1">Alertas Críticos</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🟠</span>
              <span className="text-2xl font-bold text-amber-400">{warningCount}</span>
            </div>
            <p className="text-sm font-medium text-amber-400 mt-1">Alertas de Atenção</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🟢</span>
              <span className="text-2xl font-bold text-emerald-400">{alerts.length - criticalCount - warningCount}</span>
            </div>
            <p className="text-sm font-medium text-emerald-400 mt-1">Recuperações</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
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
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  alert.type === 'error' || alert.type === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
                    : alert.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                }`}
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
                    </div>
                    <p className="text-slate-200 mt-2">{alert.message}</p>
                    {alert.type === 'error' && (
                      <div className="mt-2 pt-2 border-t border-rose-500/20">
                        <p className="text-xs text-rose-400/70">⚠️ Host offline - Verificar conectividade</p>
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