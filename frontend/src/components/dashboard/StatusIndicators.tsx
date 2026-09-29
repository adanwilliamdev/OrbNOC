'use client';

import { ArrowRight, Clock } from 'lucide-react';

interface StatusIndicatorsProps {
  connected: boolean;
  lastUpdateTime: Date | null;
  deviceCount: number;
}

export default function StatusIndicators({ connected, lastUpdateTime, deviceCount }: StatusIndicatorsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs">
      <div className="flex items-center gap-2" role="status">
        <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`} />
        <span className="text-slate-500">{connected ? 'Tempo real conectado' : 'Reconectando...'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <Clock className="size-3 text-slate-500" />
        Última atualização: {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <ArrowRight className="size-3 text-slate-500" />
        Dispositivos: {deviceCount}
      </div>
    </div>
  );
}
