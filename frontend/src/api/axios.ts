import axios from 'axios';

// withCredentials: true garante que os cookies httpOnly (access_token / refresh_token)
// sejam enviados em toda requisição e que os cookies definidos nas respostas de
// login/refresh sejam armazenados pelo navegador.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Evita disparar múltiplas chamadas de refresh em paralelo quando várias
// requisições recebem 401 ao mesmo tempo: todas aguardam a mesma promise.
let refreshingPromise: Promise<void> | null = null;

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Se o próprio /auth/login, /auth/register ou /auth/refresh falhar com 401,
    // não adianta tentar renovar a sessão: o problema é a credencial em si.
    if (isAuthEndpoint(originalRequest?.url)) {
      return Promise.reject(error);
    }

    // Evita loop infinito: só tenta renovar uma vez por requisição original.
    if (originalRequest?._retry) {
      redirectToLogin();
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    try {
      if (!refreshingPromise) {
        refreshingPromise = api
          .post('/auth/refresh')
          .then(() => undefined)
          .finally(() => {
            refreshingPromise = null;
          });
      }
      await refreshingPromise;
      return api(originalRequest);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);

export default api;
