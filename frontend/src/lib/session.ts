'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api';
import type { User } from '@/types/dashboard';

export const SESSION_KEY = ['session'] as const;

/** Usuário logado (cookie de sessão). `user === null` = sem sessão; `undefined` = ainda carregando. */
export function useSession() {
  const query = useQuery<User | null>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<User>('/api/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
  return { user: query.data, isLoading: query.isLoading, error: query.error };
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // Limpa todo o cache: nenhum dado do usuário anterior sobra na tela.
      queryClient.clear();
      window.location.replace('/login');
    }
  }, [queryClient]);
}
