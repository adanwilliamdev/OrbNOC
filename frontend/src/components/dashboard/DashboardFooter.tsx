const YEAR = new Date().getFullYear();

export default function DashboardFooter({ connected }: { connected: boolean }) {
  return (
    <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-subtle">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <li>Polling de reserva a cada 30s</li>
        <li className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${connected ? 'bg-ok' : 'bg-bad'}`} />
          Tempo real {connected ? 'conectado' : 'desconectado'}
        </li>
      </ul>
      <p>OrbNOC © {YEAR}. Desenvolvido por Adan W O Santos</p>
    </footer>
  );
}
