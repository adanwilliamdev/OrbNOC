'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { AlertEvent } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface AlertHistoryCardProps {
  alerts: AlertEvent[];
  unread: number;
  onAckAll: () => void;
}

const RAIL = {
  error: 'bg-bad',
  warning: 'bg-warn',
  success: 'bg-ok',
  info: 'bg-subtle',
} as const;

export default function AlertHistoryCard({ alerts, unread, onAckAll }: AlertHistoryCardProps) {
  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Alertas recentes
          {unread > 0 && <Badge variant="warning" className="px-2 py-0 text-[11px]">{unread}</Badge>}
        </CardTitle>
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={onAckAll} disabled={unread === 0} className="text-subtle transition-colors hover:text-foreground disabled:opacity-40">
            Marcar como lidas
          </button>
          <Link href="/alerts" className="font-medium text-primary hover:underline">
            Ver todos
          </Link>
        </div>
      </CardHeader>
      <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto px-5 pb-2">
        {alerts.slice(0, 10).map((alert) => (
          <li key={alert.id} className={cn('flex gap-3 py-3', alert.acknowledged_at && 'opacity-55')}>
            <span aria-hidden="true" className={cn('mt-0.5 w-0.5 shrink-0 self-stretch rounded-full', RAIL[alert.severity])} />
            <div className="min-w-0">
              <p className="text-sm text-foreground">{alert.message}</p>
              <p className="mt-0.5 text-xs text-subtle">{new Date(alert.created_at).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
