'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TelegramConfig, TelegramInput } from '@/types/dashboard';

interface TelegramConfigModalProps {
  open: boolean;
  config: TelegramConfig | undefined;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  /** Deve resolver `true` só quando o servidor aceitou: o modal fecha DEPOIS de salvar. */
  onSave: (input: TelegramInput) => Promise<boolean>;
}

export default function TelegramConfigModal({ open, config, saving, error, onClose, onSave }: TelegramConfigModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent>{open && <Form config={config} saving={saving} error={error} onClose={onClose} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}

function Form({ config, saving, error, onClose, onSave }: Omit<TelegramConfigModalProps, 'open'>) {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState(config?.chat_id ?? '');
  const tokenSaved = config?.bot_token_set ?? false;

  const submit = async (enabled: boolean) => {
    const ok = await onSave({ enabled, bot_token: botToken.trim() || undefined, chat_id: chatId.trim() });
    if (ok) onClose();
  };
  const canEnable = (tokenSaved || botToken.trim() !== '') && chatId.trim() !== '';

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configurar Telegram</DialogTitle>
        <DialogDescription>Receba alertas de queda, recuperação e SLA no Telegram.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="bot-token">
            Bot Token
          </Label>
          <Input
            id="bot-token"
            type="password"
            autoComplete="off"
            className="font-mono"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={tokenSaved ? 'Token salvo — deixe em branco para manter' : '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'}
          />
          {tokenSaved && <p className="text-xs text-subtle">O token é guardado criptografado e nunca é exibido de novo.</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="chat-id">
            Chat ID
          </Label>
          <Input id="chat-id" className="font-mono" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" />
        </div>
        {error && (
          <p role="alert" className="text-xs text-bad">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        {config?.enabled && (
          <Button variant="outline" onClick={() => void submit(false)} disabled={saving}>
            Desativar
          </Button>
        )}
        <Button disabled={saving || !canEnable} onClick={() => void submit(true)}>
          {saving ? 'Salvando e testando...' : 'Salvar e ativar'}
        </Button>
      </DialogFooter>
    </>
  );
}
