'use client';

import type { AlertItem } from '@/types/dashboard';

interface AlertHistoryCardProps {
  alertHistory: AlertItem[];
  unreadAlerts: number;
  onClear: () => void;
}

export default function AlertHistoryCard({ alertHistory, unreadAlerts, onClear }: AlertHistoryCardProps) {
  if (alertHistory.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-lg border border-slate-600/70 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="w-1 h-5 bg-rose-500 rounded-full"></span>
          Alertas Recentes
          {unreadAlerts > 0 && <span className="px-1.5 py-0.5 bg-amber-500/20 text-yellow-300 text-[10px] rounded-full animate-pulse">{unreadAlerts}</span>}
        </h3>
        <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors">Limpar</button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alertHistory.slice(0, 10).map((alert) => (
          <div
            key={alert.id}
            className={`p-2 rounded border transition-all ${
              alert.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/20'
                : alert.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20'
            }`}
          >
            <p className="text-xs text-slate-200">{alert.message}</p>
            <p className="text-[10px] text-slate-400 mt-1">{alert.timestamp}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
