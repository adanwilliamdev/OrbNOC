// Tipos compartilhados. Espelham o JSON da API FastAPI (schemas Pydantic do backend).
// Nomes em snake_case: são o contrato com o backend.

export type DeviceStatus = 'unknown' | 'online' | 'offline';
export type CheckType = 'icmp' | 'tcp';

export interface Device {
  id: number;
  name: string;
  ip: string;
  location: string | null;
  check_type: CheckType;
  port: number | null;
  interval_seconds: number;
  failure_threshold: number;
  sla_threshold_ms: number | null;
  sla_breached: boolean;
  status: DeviceStatus;
  latency: number | null;
  avg_latency: number | null;
  min_latency: number | null;
  max_latency: number | null;
  jitter: number | null;
  packet_loss: number | null;
  last_error: string | null;
  last_check: string | null;
  last_status_change: string | null;
  created_at: string;
}

export interface DevicePing {
  id: number;
  name: string;
  ip: string;
  status: 'online' | 'offline';
  latency_ms: number | null;
  method: 'icmp' | 'tcp';
  error: string | null;
  timestamp: string;
}

export interface DeviceMetric {
  id: number;
  device_id: number;
  ok: boolean;
  latency: number | null;
  jitter: number | null;
  packet_loss: number | null;
  recorded_at: string;
}

export interface DeviceHistory {
  device_id: number;
  hours: number;
  points: DeviceMetric[];
  summary: { uptime_pct: number | null; avg_latency: number | null; sample_count: number };
}

/** Ponto da série de uptime por hora (`/api/uptime-series`). */
export interface HistoryEntry {
  timestamp: string;
  online: number;
  offline: number;
  total: number;
  uptime: number;
  avgLatency: number;
}

export type Severity = 'success' | 'warning' | 'error' | 'info';

/** Evento/alerta persistido no servidor. */
export interface AlertEvent {
  id: number;
  device_id: number | null;
  kind: string;
  severity: Severity;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
}

export type SlaWindow = '24h' | '7d' | '30d';

export interface SlaRow {
  device_id: number;
  name: string;
  ip: string;
  location: string | null;
  status: DeviceStatus;
  window: SlaWindow;
  uptime_pct: number | null;
  avg_latency: number | null;
  sample_count: number;
  sla_threshold_ms: number | null;
}

export interface ReportSummary {
  window: SlaWindow;
  generated_at: string;
  devices: SlaRow[];
  average_uptime_pct: number | null;
  total_devices: number;
}

export interface AdvancedFilters {
  minLatency: string;
  maxLatency: string;
}

export type SortField = 'status' | 'name' | 'ip' | 'latency';
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'online' | 'offline';

export interface LatencyTrend {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'stable';
}

/** O token do bot nunca volta da API: só sabemos se existe um salvo. */
export interface TelegramConfig {
  enabled: boolean;
  chat_id: string;
  bot_token_set: boolean;
  test_sent?: boolean | null;
  test_error?: string | null;
}

export interface TelegramInput {
  enabled: boolean;
  bot_token?: string;
  chat_id?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

export interface AuthResponse {
  success: boolean;
  user: User;
}

export interface StatusDatum {
  name: string;
  value: number;
  color: string;
}

export interface BarChartDatum {
  name: string;
  fullName: string;
  latency: number;
  status: DeviceStatus;
  id: number;
}

/** Mensagens do WebSocket (`/ws`). */
export type StreamMessage =
  | { type: 'devices_update'; devices: Device[] }
  | { type: 'event'; event: AlertEvent }
  | { type: 'ping' };
