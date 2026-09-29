import { hasLatency } from '@/lib/latency';
import type { AdvancedFilters, BarChartDatum, Device, SortDirection, SortField, StatusFilter } from '@/types/dashboard';

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  availability: number;
  avgLatency: number | null;
}

export function computeStats(devices: Device[]): DeviceStats {
  const online = devices.filter((d) => d.status === 'online');
  const measured = online.filter((d) => hasLatency(d.latency));
  const known = devices.filter((d) => d.status !== 'unknown').length;
  return {
    total: devices.length,
    online: online.length,
    offline: devices.filter((d) => d.status === 'offline').length,
    unknown: devices.length - known,
    availability: known ? Math.round((online.length / known) * 100) : 0,
    avgLatency: measured.length ? measured.reduce((sum, d) => sum + (d.latency as number), 0) / measured.length : null,
  };
}

interface FilterOptions {
  search: string;
  status: StatusFilter;
  advanced: AdvancedFilters;
  sortField: SortField;
  sortDirection: SortDirection;
}

const parseLimit = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function filterAndSort(devices: Device[], { search, status, advanced, sortField, sortDirection }: FilterOptions): Device[] {
  const term = search.trim().toLowerCase();
  const min = parseLimit(advanced.minLatency);
  const max = parseLimit(advanced.maxLatency);

  const filtered = devices.filter((d) => {
    if (status !== 'all' && d.status !== status) return false;
    if (term && !(d.name.toLowerCase().includes(term) || d.ip.toLowerCase().includes(term) || d.location?.toLowerCase().includes(term))) {
      return false;
    }
    if (min !== null && !(hasLatency(d.latency) && d.latency >= min)) return false;
    if (max !== null && !(hasLatency(d.latency) && d.latency <= max)) return false;
    return true;
  });

  const rank = (d: Device) => (d.status === 'online' ? 2 : d.status === 'unknown' ? 1 : 0);
  const direction = sortDirection === 'asc' ? 1 : -1;
  return filtered.sort((a, b) => {
    let result: number;
    switch (sortField) {
      case 'name':
        result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        break;
      case 'ip':
        result = a.ip.localeCompare(b.ip, undefined, { numeric: true });
        break;
      case 'latency': {
        // Sem dado vai sempre para o fim, em qualquer direção.
        if (!hasLatency(a.latency) && !hasLatency(b.latency)) return 0;
        if (!hasLatency(a.latency)) return 1;
        if (!hasLatency(b.latency)) return -1;
        result = a.latency - b.latency;
        break;
      }
      default:
        result = rank(a) - rank(b);
    }
    return result * direction;
  });
}

export function toBarChartData(devices: Device[], limit = 15): BarChartDatum[] {
  return devices
    .filter((d) => d.status === 'online' && hasLatency(d.latency))
    .sort((a, b) => (b.latency as number) - (a.latency as number))
    .slice(0, limit)
    .map((d) => ({
      name: d.name.length > 18 ? `${d.name.slice(0, 15)}...` : d.name,
      fullName: d.name,
      latency: d.latency as number,
      status: d.status,
      id: d.id,
    }));
}

/** Baixa um arquivo servido pela API (a sessão vai no cookie). */
export function downloadFile(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
