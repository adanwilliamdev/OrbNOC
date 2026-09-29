const YEAR = new Date().getFullYear();

export default function DashboardFooter({ connected }: { connected: boolean }) {
  return (
    <footer className="mt-4 border-t border-slate-600/70 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-4 text-slate-400">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Polling de reserva: 30s</span>
          <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />Tempo real: {connected ? 'Conectado' : 'Desconectado'}</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />🟢 &lt;50ms</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />🟡 51-100ms</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />🔴 &gt;101ms</span>
        </div>
        <div className="text-center text-slate-400">
          OrbNOC Network Operations Center © {YEAR} • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
        </div>
      </div>
    </footer>
  );
}
