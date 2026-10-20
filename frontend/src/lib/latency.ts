// Cores por faixa de latência (usadas na tabela, nas barras e nos gráficos).
// 0 ms é uma medição válida (loopback/LAN): só `null`/`undefined` significam "sem dado".
import { chart } from '@/lib/theme';

export const hasLatency = (latency?: number | null): latency is number => latency != null;

export const getLatencyColor = (latency?: number | null): string => {
  if (!hasLatency(latency)) return 'text-subtle';
  if (latency <= 50) return 'text-ok';
  if (latency <= 100) return 'text-warn';
  return 'text-bad';
};

export const getLatencyBarColor = (latency?: number | null): string => {
  if (!hasLatency(latency)) return 'bg-subtle';
  if (latency <= 50) return 'bg-ok';
  if (latency <= 100) return 'bg-warn';
  return 'bg-bad';
};

export const getLatencyChartColor = (latency?: number | null): string => {
  if (!hasLatency(latency)) return chart.idle;
  if (latency <= 50) return chart.ok;
  if (latency <= 100) return chart.warn;
  return chart.bad;
};

export const formatMs = (latency?: number | null): string => {
  if (!hasLatency(latency)) return '—';
  return `${latency < 10 ? latency.toFixed(1).replace(/\.0$/, '') : Math.round(latency)}ms`;
};
