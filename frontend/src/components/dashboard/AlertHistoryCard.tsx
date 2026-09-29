'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { AlertEvent } from '@/types/dashboard';

interface AlertHistoryCardProps {
  alerts: AlertEvent[];
  unread: number;
  onAckAll: () => void;
}

const TONE = {
  error: 'border-rose-500/20 bg-rose-500/10',
  warning: 'border-amber-500/20 bg-amber-500/10',
  success: 'border-emerald-500/20 bg-emerald-500/10',
  info: 'border-blue-500/20 bg-blue-500/10',
} as const;

export default function AlertHistoryCard({ alerts, unread, onAckAll }: AlertHistoryCardProps) {
  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <span className="h-5 w-1 rounded-full bg-rose-500" />
            Alertas Recentes
            {unread > 0 && (
              <Badge variant="warning" className="animate-pulse rounded-full px-1.5 py-0.5 text-[10px] font-normal">
                {unread}
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-3 text-[10px]">
            <button type="button" onClick={onAckAll} disabled={unread === 0} className="text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-40">
              Marcar como lidas
            </button>
            <Link href="/alerts" className="text-blue-300 hover:text-blue-200">
              Ver todos
            </Link>
          </div>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {alerts.slice(0, 10).map((alert) => (
            <div key={alert.id} className={`rounded border p-2 transition-all ${TONE[alert.severity]} ${alert.acknowledged_at ? 'opacity-60' : ''}`}>
              <p className="text-xs text-slate-200">{alert.message}</p>
              <p className="mt-1 text-[10px] text-slate-400">{new Date(alert.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
