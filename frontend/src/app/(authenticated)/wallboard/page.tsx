'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
          <p className="mt-4 text-sm text-slate-400">Carregando Wallboard...</p>
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
          className={`flex items-center gap-2 rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-red-600 focus-visible:opacity-100 ${showExit ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
        >
          <ArrowLeft className="size-4" /> Sair do Wallboard
        </button>
      </div>

      <div className="flex min-h-screen flex-col p-8">
        <div className="mb-12 text-center">
          <h1 className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-4xl font-bold text-transparent sm:text-6xl">OrbNOC Wallboard</h1>
          <p className="mt-2 text-xl text-slate-500">Network Operations Center</p>
        </div>

        <div className="grid flex-1 grid-cols-1 items-center gap-8 md:grid-cols-3">
          <Metric value={stats.online} label="ONLINE" color="text-emerald-400" />
          <Metric value={`${stats.availability}%`} label="DISPONIBILIDADE" color="text-blue-400" />
          <Metric value={stats.offline} label="OFFLINE" color="text-rose-400" />
        </div>

        {offlineDevices.length > 0 && (
          <div role="alert" className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
            <h2 className="mb-4 text-xl font-bold text-rose-400">⚠️ HOSTS OFFLINE</h2>
            <div className="flex flex-wrap gap-3">
              {offlineDevices.map((d) => (
                <div key={d.id} className="rounded-lg bg-rose-500/20 px-4 py-2 text-rose-300">
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`} />
          {connected ? 'Tempo real' : 'Reconectando'} • Última atualização: {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
        </div>

        <footer className="mt-4 border-t border-slate-700 pt-4 text-center text-xs text-slate-500">
          OrbNOC Network Operations Center © {YEAR} • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
          <br />
          <span className="text-slate-600">Mova o mouse para o canto superior direito (ou pressione Esc) para sair</span>
        </footer>
      </div>
    </div>
  );
}

function Metric({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-7xl font-bold sm:text-9xl ${color}`}>{value}</div>
      <p className="mt-2 text-3xl text-slate-400">{label}</p>
    </div>
  );
}
