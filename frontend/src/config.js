// Configuração central da API e WebSocket.
// Fallback aponta para o backend local; defina NEXT_PUBLIC_API_URL
// se precisar apontar para outro host/porta.
const DEFAULT_API_URL = 'http://localhost:3001';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
