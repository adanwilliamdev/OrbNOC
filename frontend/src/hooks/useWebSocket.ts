'use client';

import { useEffect, useState, useCallback } from 'react';

interface WebSocketMessage {
  id: number;
  name: string;
  ipAddress: string;
  status: string;
  latency: number;
  changed: boolean;
  lastCheck: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  updates: WebSocketMessage[];
  lastAlert: any;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [updates, setUpdates] = useState<WebSocketMessage[]>([]);
  const [lastAlert, setLastAlert] = useState<any>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const connect = useCallback(() => {
    // Tenta conectar via WebSocket nativo
    const wsUrl = 'ws://localhost:8080/ws';
    console.log('🔄 Conectando WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket conectado!');
      setIsConnected(true);

      // Envia mensagem de subscribe para STOMP
      ws.send('SUBSCRIBE\nid:sub-0\ndestination:/topic/monitoring\n\n\u0000');
    };

    ws.onmessage = (event) => {
      try {
        // Tenta parsear como STOMP message
        let data = event.data;

        // Remove headers STOMP se existir
        if (data.includes('\n\n')) {
          const bodyStart = data.indexOf('\n\n') + 2;
          const bodyEnd = data.lastIndexOf('\u0000');
          if (bodyEnd > bodyStart) {
            data = data.substring(bodyStart, bodyEnd);
          }
        }

        // Se data for string vazia, ignora
        if (!data || data.trim() === '') {
          return;
        }

        const parsedData = JSON.parse(data);
        console.log('📨 Dados recebidos:', parsedData);

        if (Array.isArray(parsedData)) {
          setUpdates(parsedData);
        } else if (parsedData.message) {
          setLastAlert(parsedData);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket erro:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('⚠️ WebSocket desconectado, tentando reconectar em 5 segundos...');
      setIsConnected(false);
      setTimeout(() => connect(), 5000);
    };

    setSocket(ws);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect]);

  return { isConnected, updates, lastAlert };
}