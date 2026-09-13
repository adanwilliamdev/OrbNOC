'use client';

import type { FormEvent } from 'react';

interface AddDeviceFormProps {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string | null;
}

export default function AddDeviceForm({ onSubmit, submitting = false, errorMessage }: AddDeviceFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-slate-800/30 p-4 rounded-lg border border-blue-500/30">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input name="name" placeholder="Nome do equipamento" required disabled={submitting} className="bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500 disabled:opacity-60" />
        <input name="ip" placeholder="Endereço IP" required disabled={submitting} className="bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500 disabled:opacity-60" />
        <div className="flex gap-2">
          <input name="location" placeholder="Localização" disabled={submitting} className="flex-1 bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500 disabled:opacity-60" />
          {/* Trava o botão enquanto a requisição está em andamento — antes, um
              clique duplo ou repetido (ex: usuário insistindo porque não via
              nenhum retorno visível) disparava várias requisições POST
              idênticas em sequência. */}
          <button type="submit" disabled={submitting} className="px-4 bg-[#4F8CFF] hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors text-white">
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      {errorMessage && (
        <p className="mt-2 text-xs text-red-400">{errorMessage}</p>
      )}
    </form>
  );
}
