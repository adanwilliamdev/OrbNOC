// Mesma lógica de cores por faixa de latência que existia em page.js,
// apenas extraída para ser reutilizada pelos componentes do dashboard.

export const getLatencyColor = (latency?: number | null): string => {
  if (!latency) return 'text-slate-500';
  if (latency <= 50) return 'text-emerald-300';
  if (latency <= 100) return 'text-yellow-300';
  return 'text-rose-400';
};

export const getLatencyBarColor = (latency?: number | null): string => {
  if (!latency) return 'bg-slate-600';
  if (latency <= 50) return 'bg-emerald-400'; // Mais brilhante
  if (latency <= 100) return 'bg-amber-500';
  return 'bg-rose-500';
};

export const getLatencyChartColor = (latency?: number | null): string => {
  if (!latency) return '#64748b';
  if (latency <= 50) return '#34d399'; // Verde mais vivo
  if (latency <= 100) return '#f59e0b';
  return '#ef4444';
};
