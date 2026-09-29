// Cores por faixa de latência (usadas na tabela, nas barras e nos gráficos).
// 0 ms é uma medição válida (loopback/LAN): só `null`/`undefined` significam "sem dado".

export const hasLatency = (latency?: number | null): latency is number => latency != null;

export const getLatencyColor = (latency?: number | null): string => {
  if (!hasLatency(latency)) return 'text-slate-500';
  if (latency <= 50) return 'text-emerald-300';
  if (latency <= 100) return 'text-yellow-300';
  return 'text-rose-400';
};

export const getLatencyBarColor = (latency?: number | null): string => {
  if (!hasLatency(latency)) return 'bg-slate-600';
  if (latency <= 50) return 'bg-emerald-400';
  if (latency <= 100) return 'bg-amber-500';
  return 'bg-rose-500';
};

export const getLatencyChartColor = (latency?: number | null): string => {
  if (!hasLatency(latency)) return '#64748b';
  if (latency <= 50) return '#34d399';
  if (latency <= 100) return '#f59e0b';
  return '#ef4444';
};

export const formatMs = (latency?: number | null): string => {
  if (!hasLatency(latency)) return '—';
  return `${latency < 10 ? latency.toFixed(1).replace(/\.0$/, '') : Math.round(latency)}ms`;
};
