'use client';

interface DashboardFooterProps {
  connected: boolean;
}

export default function DashboardFooter({ connected }: DashboardFooterProps) {
  return (
    <footer className="border-t border-slate-600/70 pt-4 mt-4">
      <div className="flex flex-wrap justify-between items-center text-xs">
        <div className="flex gap-4 text-slate-400">
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#4F8CFF]"></div>Polling: 30s</span>
          <span className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>WebSocket: {connected ? 'Conectado' : 'Desconectado'}</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>🟢 &lt;50ms</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>🟡 51-100ms</span>
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>🔴 &gt;101ms</span>
        </div>
        <div className="text-slate-400 text-center">
          OrbNOC Network Operations Center © 2026 • Desenvolvido por <span className="text-blue-300 hover:text-blue-200 transition-colors">Adan W O Santos</span>
        </div>
      </div>
    </footer>
  );
}
