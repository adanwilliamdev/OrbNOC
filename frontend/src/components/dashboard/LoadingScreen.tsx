export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17]">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
      <h2 className="mt-4 text-lg font-semibold text-slate-200">OrbNOC</h2>
      <p className="mt-2 text-xs text-slate-500">Inicializando...</p>
    </div>
  );
}
