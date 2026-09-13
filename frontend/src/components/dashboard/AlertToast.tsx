interface AlertToastProps {
  show: boolean;
  message: string;
}

export function AlertToast({ show, message }: AlertToastProps) {
  if (!show) return null;

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg backdrop-blur-xl shadow-xl border ${
          message.includes('✅') || message.includes('📡')
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : message.includes('❌') || message.includes('🔴')
            ? 'bg-rose-500/10 border-rose-500/30'
            : message.includes('⚠️')
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-blue-500/10 border-blue-500/30'
        }`}
      >
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

interface ReconnectingBannerProps {
  reconnecting: boolean;
  connected: boolean;
}

export function ReconnectingBanner({ reconnecting, connected }: ReconnectingBannerProps) {
  if (!reconnecting || connected) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-400 animate-pulse">
      🔄 Reconectando WebSocket...
    </div>
  );
}
