import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'primary';

const VALUE: Record<Tone, string> = { neutral: 'text-foreground', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', primary: 'text-primary' };
const ICON: Record<Tone, string> = { neutral: 'bg-muted text-muted-foreground', ok: 'bg-ok/10 text-ok', warn: 'bg-warn/10 text-warn', bad: 'bg-bad/10 text-bad', primary: 'bg-primary/10 text-primary' };

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Só use cor quando o número representa um ESTADO (online, offline, atenção). */
  tone?: Tone;
  className?: string;
}

/** Indicador numérico usado nos painéis de todas as telas. */
export function StatTile({ label, value, hint, icon, tone = 'neutral', className }: StatTileProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-3 p-4', className)}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn('mt-1.5 text-3xl font-semibold tracking-tight tabular-nums', VALUE[tone])}>{value}</p>
        {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      </div>
      {icon && <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', ICON[tone])}>{icon}</span>}
    </Card>
  );
}
