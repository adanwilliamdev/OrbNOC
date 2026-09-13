export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17]">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
      <h2 className="text-lg font-semibold mt-4 text-slate-200">OrbNOC</h2>
      <p className="text-xs text-slate-500 mt-2">Inicializando...</p>
    </div>
  );
}
