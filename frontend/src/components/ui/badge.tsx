import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-muted text-muted-foreground',
      success: 'border-ok/25 bg-ok/10 text-ok',
      warning: 'border-warn/25 bg-warn/10 text-warn',
      destructive: 'border-bad/25 bg-bad/10 text-bad',
      outline: 'border-border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  /** Ponto colorido antes do texto (usa a cor do texto). */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
