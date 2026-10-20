'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { playAlertSound } from '@/lib/sound';
import type { Device, StreamMessage } from '@/types/dashboard';

export const DEVICES_KEY = ['devices'] as const;
export const EVENTS_KEY = ['events'] as const;

interface StreamState {
  connected: boolean;
  lastUpdate: Date | null;
}

const StreamContext = createContext<StreamState>({ connected: false, lastUpdate: null });
export const useStream = () => useContext(StreamContext);

const MAX_BACKOFF = 15_000;

function socketUrl(): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  if (override) return override;
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws`;
}

/**
 * Mantém o WebSocket aberto e escreve direto no cache do TanStack Query — não existe um
 * segundo estado de dispositivos. Reconecta com backoff exponencial.
 */
export function StreamProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState>({ connected: false, lastUpdate: null });
  const attempts = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const handle = (message: StreamMessage) => {
      if (message.type === 'devices_update') {
        queryClient.setQueryData<Device[]>(DEVICES_KEY, message.devices);
        setState((s) => ({ ...s, lastUpdate: new Date() }));
      } else if (message.type === 'event') {
        const event = message.event;
        void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
        const notify = event.severity === 'error' ? toast.error : event.severity === 'warning' ? toast.warning : event.severity === 'success' ? toast.success : toast.info;
        notify(event.message);
        playAlertSound(event.severity);
      }
    };

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        attempts.current = 0;
        setState((s) => ({ ...s, connected: true }));
      };
      socket.onmessage = (ev: MessageEvent<string>) => {
        try {
          handle(JSON.parse(ev.data) as StreamMessage);
        } catch {
          /* mensagem malformada: ignora */
        }
      };
      socket.onclose = (ev) => {
        setState((s) => ({ ...s, connected: false }));
        if (disposed || ev.code === 4401 || ev.code === 4403) return; // sem sessão/origem inválida: não insiste
        const delay = Math.min(MAX_BACKOFF, 1000 * 2 ** attempts.current++);
        timer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient]);

  const value = useMemo(() => state, [state]);
  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}
