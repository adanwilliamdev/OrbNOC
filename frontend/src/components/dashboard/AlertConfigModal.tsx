'use client';

import type { Device } from '@/types/dashboard';

interface AlertConfigModalProps {
  device: Device;
  currentThreshold?: number;
  onClose: () => void;
  onSave: (deviceId: Device['id'], threshold: number) => void;
}

export default function AlertConfigModal({ device, currentThreshold, onClose, onSave }: AlertConfigModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900 border border-slate-600/70 rounded-lg p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">Configurar Alerta SLA</h3>
        <p className="text-sm text-slate-400 mb-4">{device.name}</p>
        <div className="space-y-2 mb-6">
          <label className="text-xs text-slate-400 uppercase tracking-wider">Limite de Latência (ms)</label>
          <input
            type="number"
            id="modal-threshold"
            min="10"
            max="1000"
            defaultValue={currentThreshold || 120}
            className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors">Cancelar</button>
          <button
            onClick={() => {
              const input = document.getElementById('modal-threshold') as HTMLInputElement | null;
              const threshold = input ? parseInt(input.value, 10) : NaN;
              if (threshold) onSave(device.id, threshold);
            }}
            className="px-4 py-2 bg-[#4F8CFF] text-white rounded-lg text-sm hover:bg-blue-500 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
