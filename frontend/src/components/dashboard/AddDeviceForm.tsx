'use client';

import type { FormEvent } from 'react';

interface AddDeviceFormProps {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export default function AddDeviceForm({ onSubmit }: AddDeviceFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-slate-800/30 p-4 rounded-lg border border-blue-500/30">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input name="name" placeholder="Nome do equipamento" required className="bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500" />
        <input name="ip" placeholder="Endereço IP" required className="bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500" />
        <div className="flex gap-2">
          <input name="location" placeholder="Localização" className="flex-1 bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500" />
          <button type="submit" className="px-4 bg-[#4F8CFF] hover:bg-blue-500 rounded-lg text-sm transition-colors text-white">Salvar</button>
        </div>
      </div>
    </form>
  );
}
