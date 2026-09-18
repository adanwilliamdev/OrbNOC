import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    // O access token vive em um cookie httpOnly (não visível ao JS), então a
    // única forma de saber se já existe uma sessão válida é perguntar ao backend.
    refreshUser().finally(() => setLoading(false));
  }, []);

  async function login(email: string, senha: string) {
    const profile = await authApi.login(email, senha);
    setUser(profile);
  }

  async function register(nome: string, email: string, senha: string) {
    const profile = await authApi.register(nome, email, senha);
    setUser(profile);
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return ctx;
}
