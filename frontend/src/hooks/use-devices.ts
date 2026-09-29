'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { computeStats } from '@/lib/devices';
import { DEVICES_KEY } from '@/providers/stream-provider';
import type { Device, DevicePing } from '@/types/dashboard';

export interface NewDevice {
  name: string;
  ip: string;
  location?: string;
  check_type?: 'icmp' | 'tcp';
  port?: number;
}

/** Lista de dispositivos. O WebSocket escreve neste cache; o polling de 30 s é só reserva. */
export function useDevices() {
  const query = useQuery({
    queryKey: DEVICES_KEY,
    queryFn: () => apiFetch<Device[]>('/api/devices'),
    refetchInterval: 30_000,
  });
  const devices = useMemo(() => query.data ?? [], [query.data]);
  const stats = useMemo(() => computeStats(devices), [devices]);
  return { ...query, devices, stats };
}

export function useAddDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewDevice) => apiFetch<Device>('/api/devices', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ success: boolean }>(`/api/devices/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => qc.setQueryData<Device[]>(DEVICES_KEY, (old = []) => old.filter((d) => d.id !== id)),
  });
}

export function usePingDevice() {
  return useMutation({
    mutationFn: (id: number) => apiFetch<DevicePing>(`/api/devices/${id}/ping`),
  });
}

/** `threshold_ms: null` remove o limite. */
export function useConfigureSla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { device_id: number; threshold_ms: number | null }) =>
      apiFetch<{ success: boolean; message: string }>('/api/alerts/sla/configure', { method: 'POST', body: vars }),
    onSuccess: (_, vars) =>
      qc.setQueryData<Device[]>(DEVICES_KEY, (old = []) =>
        old.map((d) => (d.id === vars.device_id ? { ...d, sla_threshold_ms: vars.threshold_ms, sla_breached: vars.threshold_ms ? d.sla_breached : false } : d)),
      ),
  });
}
