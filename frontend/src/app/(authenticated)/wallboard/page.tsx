'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import FleetStrip from '@/components/dashboard/FleetStrip';
import { cn } from '@/lib/utils';
import { useDevices } from '@/hooks/use-devices';
import { useStream } from '@/providers/stream-provider';

const YEAR = new Date().getFullYear();

/** Painel de parede: dados vêm do mesmo cache do WebSocket (sem polling próprio). */
export default function WallboardPage() {
  const router = useRouter();
  const { devices, stats, isLoading } = useDevices();
  const { connected, lastUpdate } = useStream();
  const [showExit, setShowExit] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowExit(true), 3000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && router.push('/');
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando Wallboard...</p>
        </div>
      </div>
    );
  }

  const offlineDevices = devices.filter((d) => d.status === 'offline');

  return (
    <div className="min-h-screen">
      <div className="fixed top-4 right-4 z-50" onMouseEnter={() => setShowExit(true)} onMouseLeave={() => setShowExit(false)} onFocus={() => setShowExit(true)}>
        <button
          type="button"
          onClick={() => router.push('/')}
          className={`flex items-center gap-2 rounded-lg border border-border bg-popover/90 px-4 py-2 text-sm font-medium text-foreground shadow-pop backdrop-blur-sm transition-all duration-300 hover:bg-accent focus-visible:opacity-100 ${showExit ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
        >
          <ArrowLeft className="size-4" /> Sair do Wallboard
        </button>
      </div>

      <div className="flex min-h-screen flex-col p-8">
        <div className="mb-10 flex flex-col items-center text-center">
          <BrandMark size="lg" />
          <h1 className="mt-4 text-4xl font-semibold text-foreground sm:text-5xl">OrbNOC</h1>
          <p className="mt-1 text-lg text-muted-foreground">Network Operations Center</p>
        </div>

        <div className="grid flex-1 grid-cols-1 items-center gap-8 md:grid-cols-3">
          <Metric value={stats.online} label="Online" color="text-ok" />
          <Metric value={`${stats.availability}%`} label="Disponibilidade" color="text-foreground" />
          <Metric value={stats.offline} label="Offline" color={stats.offline > 0 ? 'text-bad' : 'text-foreground'} />
        </div>

        <FleetStrip devices={devices} size="lg" className="mt-10" />

        {offlineDevices.length > 0 && (
          <div role="alert" className="mt-8 rounded-2xl border border-bad/40 bg-bad/10 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-bad">
              <TriangleAlert className="size-6" /> Hosts offline
            </h2>
            <div className="flex flex-wrap gap-3">
              {offlineDevices.map((d) => (
                <div key={d.id} className="rounded-lg bg-bad/15 px-4 py-2 text-foreground">
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className={cn('size-2 rounded-full', connected ? 'animate-halo bg-ok [--halo:var(--ok)]' : 'bg-bad')} />
          {connected ? 'Tempo real' : 'Reconectando'}. Última atualização: {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
        </div>

        <footer className="mt-4 border-t border-border pt-4 text-center text-xs text-subtle">
          OrbNOC © {YEAR}. Desenvolvido por Adan W O Santos
          <br />
          <span className="text-subtle/70">Mova o mouse para o canto superior direito (ou pressione Esc) para sair</span>
        </footer>
      </div>
    </div>
  );
}

function Metric({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-7xl font-semibold tracking-tight tabular-nums sm:text-9xl ${color}`}>{value}</div>
      <p className="mt-3 text-2xl text-muted-foreground">{label}</p>
    </div>
  );
}
