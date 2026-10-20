'use client';

import { Bell, BellOff, CheckCheck, Download, FileText, MessageCircle, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ReactNode } from 'react';
import type { TelegramConfig } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  refreshing: boolean;
  unreadAlerts: number;
  soundEnabled: boolean;
  telegramConfig: TelegramConfig | undefined;
  /** Linha de contexto sob o título (estado do tempo real). */
  meta: ReactNode;
  onRefresh: () => void;
  onAckAll: () => void;
  onToggleSound: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  onPrint: () => void;
  onOpenTelegramModal: () => void;
}

/** Cabeçalho da página do painel: título, contexto e ações. A navegação fica na AppBar. */
export default function DashboardHeader({ refreshing, unreadAlerts, soundEnabled, telegramConfig, meta, onRefresh, onAckAll, onToggleSound, onExport, onPrint, onOpenTelegramModal }: DashboardHeaderProps) {
  const telegramOn = telegramConfig?.enabled ?? false;
  return (
    <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <h1 className="text-2xl leading-tight font-semibold text-foreground">Painel</h1>
        <div className="mt-1.5">{meta}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onOpenTelegramModal} className={cn(telegramOn && 'border-primary/40 text-primary hover:border-primary/60')}>
          <MessageCircle /> {telegramOn ? 'Telegram ativo' : 'Telegram desativado'}
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

        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button variant="ghost" size="icon" className="size-8" onClick={onRefresh} disabled={refreshing} aria-label="Sincronizar" title="Sincronizar">
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onAckAll} disabled={unreadAlerts === 0} aria-label="Marcar todos os alertas como lidos" title="Marcar todos os alertas como lidos">
            <CheckCheck />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onToggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Desativar som de alerta' : 'Ativar som de alerta'} title={soundEnabled ? 'Desativar som de alerta' : 'Ativar som de alerta'}>
            {soundEnabled ? <Bell /> : <BellOff className="text-subtle" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
