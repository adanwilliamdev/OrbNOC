import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-1 text-sm text-slate-100 transition-colors outline-none placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-rose-500',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
