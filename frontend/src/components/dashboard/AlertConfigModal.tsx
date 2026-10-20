'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Device } from '@/types/dashboard';

interface AlertConfigModalProps {
  device: Device | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (deviceId: number, threshold: number) => void;
}

export default function AlertConfigModal({ device, saving = false, onClose, onSave }: AlertConfigModalProps) {
  return (
    <Dialog open={device !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* Remontado a cada dispositivo para reiniciar o valor do campo. */}
        {device && <Form key={device.id} device={device} saving={saving} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ device, saving, onClose, onSave }: { device: Device; saving: boolean; onClose: () => void; onSave: (id: number, threshold: number) => void }) {
  const [value, setValue] = useState(String(device.sla_threshold_ms ?? 120));
  const threshold = Number.parseInt(value, 10);
  const valid = Number.isInteger(threshold) && threshold >= 1 && threshold <= 60000;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configurar Alerta SLA</DialogTitle>
        <DialogDescription>
          {device.name} — avisa quando a latência passar do limite (uma vez por ocorrência).
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="sla-threshold">
          Limite de Latência (ms)
        </Label>
        <Input id="sla-threshold" type="number" min={1} max={60000} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!valid} />
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!valid || saving} onClick={() => onSave(device.id, threshold)}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </>
  );
}
