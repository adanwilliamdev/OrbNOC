'use client';

import type { TelegramConfig, User } from '@/types/dashboard';

interface DashboardHeaderProps {
  connected: boolean;
  user: User | null;
  refreshing: boolean;
  showExportMenu: boolean;
  isGeneratingPDF: boolean;
  telegramConfig: TelegramConfig;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onClearAlertHistory: () => void;
  onToggleExportMenu: () => void;
  onExportCSV: () => void;
  onGeneratePDF: () => void;
  onOpenTelegramModal: () => void;
  onLogout: () => void;
}

export default function DashboardHeader({
  connected,
  user,
  refreshing,
  showExportMenu,
  isGeneratingPDF,
  telegramConfig,
  onNavigate,
  onRefresh,
  onClearAlertHistory,
  onToggleExportMenu,
  onExportCSV,
  onGeneratePDF,
  onOpenTelegramModal,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <div className="bg-[#121a2b] backdrop-blur-sm rounded-xl p-4 border border-slate-600/70">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-[#4F8CFF] to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6 L12 12 L20 6" strokeLinecap="round" />
                <path d="M4 12 L12 18 L20 12" strokeLinecap="round" />
              </svg>
            </div>
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent">OrbNOC</h1>
            <p className="text-xs text-slate-500">Network Operations Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => onNavigate('/network-map')} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all text-sm flex items-center gap-1">
            <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            Mapa
          </button>
          <button onClick={() => onNavigate('/alerts')} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all text-sm flex items-center gap-1">
            <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Alertas
          </button>
          <button onClick={() => onNavigate('/reports')} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all text-sm flex items-center gap-1">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Relatórios
          </button>
          <button onClick={() => onNavigate('/diagnostic')} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all text-sm flex items-center gap-1">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Diagnóstico
          </button>
          <button onClick={() => onNavigate('/wallboard')} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all text-sm flex items-center gap-1">
            <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Wallboard
          </button>

          <div className="w-px h-6 bg-slate-600/70 mx-1" />

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121a2b] rounded-lg border border-slate-600/70">
            <span className="text-xs text-slate-300">{user?.username}</span>
          </div>

          <button onClick={onRefresh} disabled={refreshing} className="p-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all">
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button onClick={onClearAlertHistory} className="p-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <div className="relative export-dropdown">
            <button onClick={onToggleExportMenu} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg border border-slate-600/70 transition-all text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 bg-[#121a2b] rounded-lg shadow-xl z-50 border border-slate-600/70 min-w-[160px]">
                <button onClick={onExportCSV} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors rounded-t-lg">📊 CSV / Excel</button>
                <button onClick={onGeneratePDF} disabled={isGeneratingPDF} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors rounded-b-lg border-t border-slate-600/70">📄 {isGeneratingPDF ? 'Gerando...' : 'PDF'}</button>
              </div>
            )}
          </div>

          <button onClick={onOpenTelegramModal} className={`px-3 py-2 rounded-lg border transition-all text-sm flex items-center gap-1 ${telegramConfig.enabled ? 'bg-blue-600/20 border-blue-500/30 text-blue-300' : 'bg-[#121a2b] border-slate-600/70 text-slate-400'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            {telegramConfig.enabled ? 'Telegram ON' : 'Telegram OFF'}
          </button>

          {/* Botão Sair - agora neutro */}
          <button onClick={onLogout} className="px-3 py-2 bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg border border-slate-600/70 transition-all text-sm">
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
