'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, Map, MonitorPlay, ServerCog, Siren, Users } from 'lucide-react';
import { useAlerts } from '@/hooks/use-alerts';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/network-map', label: 'Mapa', icon: Map },
  { href: '/alerts', label: 'Alertas', icon: Siren },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/diagnostic', label: 'Diagnóstico', icon: ServerCog },
  { href: '/wallboard', label: 'Wallboard', icon: MonitorPlay },
];

export default function MainNav() {
  const pathname = usePathname();
  const { unread } = useAlerts(50);
  const { user } = useSession();
  const items = user?.role === 'admin' ? [...NAV, { href: '/users', label: 'Usuários', icon: Users }] : NAV;

  return (
    <nav aria-label="Principal" className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Icon className={cn('size-4', active ? 'text-primary' : 'text-subtle')} />
            {label}
            {href === '/alerts' && unread > 0 && <span className="rounded-full bg-warn/15 px-1.5 text-[11px] leading-5 font-semibold text-warn tabular-nums">{unread > 99 ? '99+' : unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
