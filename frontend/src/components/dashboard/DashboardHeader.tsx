'use client';

import Link from 'next/link';
import { BarChart3, Bell, BellOff, CheckCheck, Download, FileText, Map, MessageCircle, MonitorPlay, Printer, RefreshCw, ServerCog, Siren } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { TelegramConfig, User } from '@/types/dashboard';

interface DashboardHeaderProps {
  connected: boolean;
  user: User | null | undefined;
  refreshing: boolean;
  unreadAlerts: number;
  soundEnabled: boolean;
  telegramConfig: TelegramConfig | undefined;
  onRefresh: () => void;
  onAckAll: () => void;
  onToggleSound: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  onPrint: () => void;
  onOpenTelegramModal: () => void;
  onLogout: () => void;
}

const NAV = [
  { href: '/network-map', label: 'Mapa', icon: Map, color: 'text-blue-300' },
  { href: '/alerts', label: 'Alertas', icon: Siren, color: 'text-yellow-300' },
  { href: '/reports', label: 'Relatórios', icon: BarChart3, color: 'text-indigo-400' },
  { href: '/diagnostic', label: 'Diagnóstico', icon: ServerCog, color: 'text-purple-400' },
  { href: '/wallboard', label: 'Wallboard', icon: MonitorPlay, color: 'text-emerald-300' },
];

export default function DashboardHeader({
  connected,
  user,
  refreshing,
  unreadAlerts,
  soundEnabled,
  telegramConfig,
  onRefresh,
  onAckAll,
  onToggleSound,
  onExport,
  onPrint,
  onOpenTelegramModal,
  onLogout,
}: DashboardHeaderProps) {
  const telegramOn = telegramConfig?.enabled ?? false;
  return (
    <header className="rounded-xl border border-slate-600/70 bg-card p-4 backdrop-blur-sm">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#4F8CFF] to-blue-500 shadow-lg shadow-blue-500/20">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6 L12 12 L20 6" strokeLinecap="round" />
                <path d="M4 12 L12 18 L20 12" strokeLinecap="round" />
              </svg>
            </div>
            <div
              role="status"
              aria-label={connected ? 'Tempo real conectado' : 'Tempo real desconectado'}
              className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`}
            />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-xl font-bold text-transparent">OrbNOC</h1>
            <p className="text-xs text-slate-500">Network Operations Center</p>
          </div>
        </div>

        <nav aria-label="Principal" className="flex flex-wrap items-center gap-2">
          {NAV.map(({ href, label, icon: Icon, color }) => (
            <Button key={href} asChild variant="outline">
              <Link href={href}>
                <Icon className={color} /> {label}
                {href === '/alerts' && unreadAlerts > 0 && (
                  <Badge variant="warning" className="rounded-full px-1.5 py-0 text-[10px]">
                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                  </Badge>
                )}
              </Link>
            </Button>
          ))}

          <div className="mx-1 hidden h-6 w-px bg-slate-600/70 sm:block" />

          <div className="rounded-lg border border-slate-600/70 bg-card px-3 py-1.5 text-xs text-slate-300">{user?.username}</div>

          <Button variant="outline" size="icon" onClick={onRefresh} disabled={refreshing} aria-label="Sincronizar">
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" size="icon" onClick={onAckAll} disabled={unreadAlerts === 0} aria-label="Marcar todos os alertas como lidos" title="Marcar todos os alertas como lidos">
            <CheckCheck />
          </Button>
          <Button variant="outline" size="icon" onClick={onToggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Desativar som de alerta' : 'Ativar som de alerta'}>
            {soundEnabled ? <Bell /> : <BellOff className="text-slate-500" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onExport('csv')}>
                <FileText className="size-4" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExport('xlsx')}>
                <FileText className="size-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onPrint}>
                <Printer className="size-4" /> PDF (imprimir)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={onOpenTelegramModal} className={telegramOn ? 'border-blue-500/30 bg-blue-600/20 text-blue-300' : 'text-slate-400'}>
            <MessageCircle /> {telegramOn ? 'Telegram ON' : 'Telegram OFF'}
          </Button>

          <Button variant="secondary" onClick={onLogout}>
            Sair
          </Button>
        </nav>
      </div>
    </header>
  );
}
