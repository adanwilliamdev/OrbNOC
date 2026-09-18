'use client';

interface StatusIndicatorsProps {
  connected: boolean;
  lastUpdateTime: Date | null;
  deviceCount: number;
  chartTimeWindow: number;
  onChartTimeWindowChange: (seconds: number) => void;
}

export default function StatusIndicators({
  connected,
  lastUpdateTime,
  deviceCount,
  chartTimeWindow,
  onChartTimeWindowChange,
}: StatusIndicatorsProps) {
  return (
    <div className="flex flex-wrap gap-4 text-xs">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
        <span className="text-slate-500">{connected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}</span>
      </div>
      <div className="flex items-center gap-2">
        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="text-slate-400">Última atualização: {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}</span>
      </div>
      <div className="flex items-center gap-2">
        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
        <span className="text-slate-400">Dispositivos: {deviceCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-400">📊 Janela: {chartTimeWindow}s</span>
        <select
          value={chartTimeWindow}
          onChange={(e) => onChartTimeWindowChange(parseInt(e.target.value, 10))}
          className="bg-[#121a2b] border border-slate-600/70 rounded px-2 py-0.5 text-xs text-slate-300"
        >
          <option value={30}>30s</option>
          <option value={60}>60s</option>
          <option value={120}>120s</option>
          <option value={300}>5min</option>
        </select>
      </div>
    </div>
  );
}
