import { cn } from '@/lib/utils';

/** Marca do OrbNOC: dois chevrons empilhados num azulejo amarelo. `status` mostra o ponto de tempo real. */
export default function BrandMark({ size = 'md', status, className }: { size?: 'md' | 'lg'; status?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span className={cn('flex items-center justify-center bg-primary text-primary-foreground', size === 'lg' ? 'size-14 rounded-2xl' : 'size-9 rounded-lg')}>
        <svg className={size === 'lg' ? 'size-7' : 'size-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6 L12 12 L20 6" />
          <path d="M4 12 L12 18 L20 12" />
        </svg>
      </span>
      {status !== undefined && (
        <span
          role="status"
          aria-label={status ? 'Tempo real conectado' : 'Tempo real desconectado'}
          className={cn('absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-background', status ? 'bg-ok' : 'bg-bad')}
        />
      )}
    </span>
  );
}
