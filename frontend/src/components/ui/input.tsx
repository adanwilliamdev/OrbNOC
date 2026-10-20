import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-subtle hover:border-strong focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
