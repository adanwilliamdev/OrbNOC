import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('✅ Conectado ao backend WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão com backend:', error);
});

socket.on('disconnect', () => {
  console.log('⚠️ Desconectado do backend');
});

export default socket;