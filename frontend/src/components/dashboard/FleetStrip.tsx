import type { Device } from '@/types/dashboard';
import { cn } from '@/lib/utils';

const TICK = {
  online: 'bg-ok',
  offline: 'animate-halo bg-bad',
  unknown: 'bg-subtle/60',
} as const;

/** Um tique por dispositivo, colorido pelo estado: a saúde da frota de relance. */
export default function FleetStrip({ devices, size = 'md', className }: { devices: Device[]; size?: 'md' | 'lg'; className?: string }) {
  const order = { offline: 0, unknown: 1, online: 2 } as const;
  const sorted = [...devices].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div role="img" aria-label={`${devices.length} dispositivos, um tique por estado`} className={cn('flex w-full items-stretch gap-1', size === 'lg' ? 'h-14' : 'h-7', className)}>
      {sorted.map((d) => (
        <span key={d.id} title={`${d.name}: ${d.status}`} className={cn('min-w-[3px] flex-1 rounded-[3px]', TICK[d.status])} />
      ))}
    </div>
  );
}
