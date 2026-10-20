'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { EVENTS_KEY } from '@/providers/stream-provider';
import type { AlertEvent, HistoryEntry, ReportSummary, SlaWindow, TelegramConfig, TelegramInput } from '@/types/dashboard';

/** Histórico de alertas — persistido no servidor (antes ficava no localStorage). */
export function useAlerts(limit = 100) {
  const query = useQuery({
    queryKey: [...EVENTS_KEY, 'list', limit],
    queryFn: () => apiFetch<AlertEvent[]>(`/api/alerts?limit=${limit}`),
    refetchInterval: 60_000,
  });
  const alerts = useMemo(() => query.data ?? [], [query.data]);
  const unread = useMemo(() => alerts.filter((a) => a.acknowledged_at === null).length, [alerts]);
  return { ...query, alerts, unread };
}

export function useAckAlerts() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: EVENTS_KEY });
  const ackOne = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/alerts/${id}/ack`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const ackAll = useMutation({
    mutationFn: () => apiFetch('/api/alerts/ack-all', { method: 'POST' }),
    onSuccess: invalidate,
  });
  return { ackOne, ackAll };
}

export function useTelegram() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['telegram'],
    queryFn: () => apiFetch<TelegramConfig>('/api/alerts/telegram'),
  });
  const save = useMutation({
    mutationFn: (body: TelegramInput) => apiFetch<TelegramConfig>('/api/alerts/telegram', { method: 'POST', body }),
    onSuccess: (data) => qc.setQueryData(['telegram'], data),
  });
  return { config: query.data, isLoading: query.isLoading, save };
}

/** Série de uptime por hora (24 h) — substitui o histórico que era guardado no navegador. */
export function useUptimeSeries(hours = 24) {
  return useQuery({
    queryKey: ['uptime-series', hours],
    queryFn: () => apiFetch<HistoryEntry[]>(`/api/uptime-series?hours=${hours}`),
    refetchInterval: 60_000,
  });
}

export function useReportSummary(window: SlaWindow) {
  return useQuery({
    queryKey: ['report-summary', window],
    queryFn: () => apiFetch<ReportSummary>(`/api/reports/summary?window=${window}`),
    refetchInterval: 60_000,
  });
}
