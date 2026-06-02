export const dynamic = 'force-dynamic';
export const revalidate = 0;

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AlertsPage() {
  const router = useRouter();
  const [alertHistory, setAlertHistory] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const savedAlerts = localStorage.getItem('orbnoc_alert_history');
    if (savedAlerts) {
      setAlertHistory(JSON.parse(savedAlerts));
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-200 mb-6">Histórico de Alertas</h1>
        <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-6">
          {alertHistory.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Nenhum alerta registrado</p>
          ) : (
            <div className="space-y-3">
              {alertHistory.slice(0, 50).map((alert, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${
                  alert.type === 'error' ? 'bg-rose-500/10 border-rose-500/20' :
                  alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                  'bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  <p className="text-slate-200">{alert.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{alert.timestamp}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}