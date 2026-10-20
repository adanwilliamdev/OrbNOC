'use client';

import { Clock, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusIndicatorsProps {
  connected: boolean;
  lastUpdateTime: Date | null;
  deviceCount: number;
}

export default function StatusIndicators({ connected, lastUpdateTime, deviceCount }: StatusIndicatorsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2" role="status">
        <span className={cn('size-2 rounded-full', connected ? 'animate-halo bg-ok [--halo:var(--ok)]' : 'bg-bad')} />
        {connected ? 'Tempo real conectado' : 'Reconectando...'}
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="size-3.5 text-subtle" />
        Atualizado às {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}
      </div>
      <div className="flex items-center gap-1.5">
        <Server className="size-3.5 text-subtle" />
        {deviceCount} {deviceCount === 1 ? 'dispositivo' : 'dispositivos'}
      </div>
    </div>
  );
}
