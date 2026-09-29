'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <div className={`mx-auto ${maxWidth} p-4 sm:p-6`}>
        <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center print:hidden">
          <div>
            <h1 className="flex items-center gap-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-2xl font-bold text-transparent">
              <span aria-hidden="true" className="text-3xl">{icon}</span> {title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft /> Voltar
              </Link>
            </Button>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-8 border-t border-slate-700 pt-4 text-center text-xs text-slate-500">
          OrbNOC Network Operations Center © {YEAR} • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
        </footer>
      </div>
    </div>
  );
}
