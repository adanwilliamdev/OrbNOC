'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { NewDevice } from '@/hooks/use-devices';

interface AddDeviceFormProps {
  onSubmit: (device: NewDevice) => void;
  submitting?: boolean;
  errorMessage?: string | null;
}

export default function AddDeviceForm({ onSubmit, submitting = false, errorMessage }: AddDeviceFormProps) {
  const [checkType, setCheckType] = useState<'icmp' | 'tcp'>('icmp');

  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const port = Number(form.get('port'));
    const interval = Number(form.get('interval_seconds'));
    onSubmit({
      name: String(form.get('name') ?? '').trim(),
      ip: String(form.get('ip') ?? '').trim(),
      location: String(form.get('location') ?? '').trim() || undefined,
      check_type: checkType,
      port: checkType === 'tcp' && port ? port : undefined,
      interval_seconds: Number.isInteger(interval) && interval >= 5 ? interval : undefined,
    });
  };

  return (
    <form onSubmit={handle} className="rounded-lg border border-blue-500/30 bg-slate-800/30 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Input name="name" placeholder="Nome do equipamento" aria-label="Nome do equipamento" required disabled={submitting} />
        <Input name="ip" placeholder="IP ou hostname" aria-label="IP ou hostname" required disabled={submitting} />
        <Input name="location" placeholder="Localização" aria-label="Localização" disabled={submitting} />
        <Input name="interval_seconds" type="number" min={5} max={3600} defaultValue={30} aria-label="Intervalo de checagem em segundos" title="Intervalo de checagem (segundos)" disabled={submitting} />
        <div className="flex gap-2">
          <Select value={checkType} onValueChange={(v) => setCheckType(v as 'icmp' | 'tcp')} disabled={submitting}>
            <SelectTrigger aria-label="Tipo de checagem" className="w-24 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="icmp">Ping</SelectItem>
              <SelectItem value="tcp">TCP</SelectItem>
            </SelectContent>
          </Select>
          {checkType === 'tcp' && <Input name="port" type="number" min={1} max={65535} placeholder="Porta" aria-label="Porta" required disabled={submitting} className="w-24" />}
          {/* Travado durante a requisição: cliques repetidos não disparam POSTs duplicados. */}
          <Button type="submit" disabled={submitting} className="ml-auto">
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
