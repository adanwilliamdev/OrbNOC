'use client';

import type { TelegramConfig } from '@/types/dashboard';

interface TelegramConfigModalProps {
  config: TelegramConfig;
  saving: boolean;
  onClose: () => void;
  onSave: (enabled: boolean, botToken: string, chatId: string) => void;
}

export default function TelegramConfigModal({ config, saving, onClose, onSave }: TelegramConfigModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900 border border-slate-600/70 rounded-lg p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">Configurar Telegram</h3>
        <p className="text-sm text-slate-400 mb-4">Receba alertas no Telegram</p>
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs text-slate-400 block mb-1 uppercase tracking-wider">Bot Token</label>
            <input
              type="text"
              id="config-bot-token"
              defaultValue={config.botToken}
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1 uppercase tracking-wider">Chat ID</label>
            <input
              type="text"
              id="config-chat-id"
              defaultValue={config.chatId}
              placeholder="-1001234567890"
              className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 text-slate-200"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors">Cancelar</button>
          <button
            onClick={() => {
              const botTokenInput = document.getElementById('config-bot-token') as HTMLInputElement | null;
              const chatIdInput = document.getElementById('config-chat-id') as HTMLInputElement | null;
              const botToken = botTokenInput?.value.trim() || '';
              const chatId = chatIdInput?.value.trim() || '';
              onSave(!!(botToken && chatId), botToken, chatId);
              onClose();
            }}
            disabled={saving}
            className="px-4 py-2 bg-[#4F8CFF] text-white rounded-lg text-sm hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
