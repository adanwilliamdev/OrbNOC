// Tipos compartilhados do dashboard.
// Espelham o shape retornado por `GET /api/devices` no backend (UserDevice).
// Nenhum campo foi inventado além do que a API já envia/consome hoje.

export type DeviceStatus = 'online' | 'offline';

export interface Device {
  id: number | string;
  name: string;
  ip: string;
  location?: string | null;
  status: DeviceStatus;
  latency?: number | null;
  avg_latency?: number | null;
  min_latency?: number | null;
  max_latency?: number | null;
  jitter?: number | null;
  packet_loss?: number | null;
  last_check?: string | null;
}

export interface HistoryEntry {
  timestamp: string;
  online: number;
  offline: number;
  total: number;
  uptime: number;
  avgLatency: number;
}

export type AlertType = 'success' | 'warning' | 'error' | 'info';

export interface AlertItem {
  id: number;
  message: string;
  type: AlertType;
  timestamp: string;
  read: boolean;
}

export interface AdvancedFilters {
  minLatency: string;
  maxLatency: string;
  minUptime: string;
  tags: string[];
}

export type SortField = 'status' | 'name' | 'ip' | 'latency' | string;
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | DeviceStatus;

export interface LatencyTrend {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'stable';
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

export interface User {
  id: number | string;
  username: string;
  [key: string]: unknown;
}

export interface StatusDatum {
  name: string;
  value: number;
  color: string;
}

export interface TimelineDatum {
  time: string;
  online: number;
  offline: number;
  uptime: number;
}

export interface ChartData {
  statusData: StatusDatum[];
  timelineData: TimelineDatum[];
}

export interface BarChartDatum {
  name: string;
  fullName: string;
  latency: number;
  status: DeviceStatus | string;
  id: string | number;
}
