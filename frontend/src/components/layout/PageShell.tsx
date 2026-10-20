'use client';

import type { ReactNode } from 'react';
import AppBar from '@/components/layout/AppBar';
import { cn } from '@/lib/utils';

interface PageShellProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  actions?: ReactNode;
  maxWidth?: string;
  children: ReactNode;
}

const YEAR = new Date().getFullYear();

export default function PageShell({ title, subtitle, icon, actions, maxWidth = 'max-w-7xl', children }: PageShellProps) {
  return (
    <div className="min-h-screen">
      <AppBar maxWidth={maxWidth} />
      <div className={cn('mx-auto px-4 py-6 sm:px-6 sm:py-8', maxWidth)}>
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center print:hidden">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary [&_svg]:size-5">
              {icon}
            </span>
            <div>
              <h1 className="text-2xl leading-tight font-semibold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <main>{children}</main>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-subtle">
          <span>OrbNOC © {YEAR}</span>
          <span>Desenvolvido por Adan W O Santos</span>
        </footer>
      </div>
    </div>
  );
}
