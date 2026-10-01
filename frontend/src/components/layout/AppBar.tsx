'use client';

import { LogOut } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import MainNav from '@/components/layout/MainNav';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/lib/session';
import { useStream } from '@/providers/stream-provider';
import { cn } from '@/lib/utils';

/** Barra superior única de todas as telas: marca, navegação e usuário. */
export default function AppBar({ maxWidth = 'max-w-7xl' }: { maxWidth?: string }) {
  const { user } = useSession();
  const { connected } = useStream();
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md print:hidden">
      <div className={cn('mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:flex-nowrap', maxWidth)}>
        <div className="flex items-center gap-3">
          <BrandMark status={connected} />
          <span className="text-base font-semibold tracking-tight text-foreground">OrbNOC</span>
        </div>
        <div className="order-3 w-full min-w-0 lg:order-none lg:w-auto lg:flex-1">
          <MainNav />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-md border border-border py-1 pr-3 pl-1 text-sm text-muted-foreground">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded bg-muted text-xs font-semibold text-foreground uppercase">
              {user?.username?.charAt(0)}
            </span>
            {user?.username}
          </span>
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Sair" title="Sair">
            <LogOut />
          </Button>
        </div>
      </div>
    </header>
  );
}
