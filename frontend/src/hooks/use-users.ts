'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { AdminUser } from '@/types/dashboard';

const KEY = ['admin-users'] as const;

export interface NewUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UserChanges {
  is_active?: boolean;
  role?: 'admin' | 'user';
  password?: string;
}

/** Só o admin consegue listar (a API responde 403 para os demais). */
export function useUsers(enabled: boolean) {
  return useQuery({ queryKey: KEY, queryFn: () => apiFetch<AdminUser[]>('/api/users'), enabled });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: (body: NewUser) => apiFetch<AdminUser>('/api/users', { method: 'POST', body }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: UserChanges }) => apiFetch<AdminUser>(`/api/users/${id}`, { method: 'PATCH', body: changes }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiFetch<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  return { create, update, remove };
}
