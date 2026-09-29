'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiError } from '@/lib/api';
import { SESSION_KEY, useSession } from '@/lib/session';
import type { AuthResponse } from '@/types/dashboard';

const YEAR = new Date().getFullYear();

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => apiFetch<{ registration_enabled: boolean }>('/api/auth/config'), retry: false });
  const registrationEnabled = config.data?.registration_enabled ?? false;

  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Já autenticado: vai direto para o dashboard.
  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  const auth = useMutation({
    mutationFn: (body: { username: string; email?: string; password: string }) => apiFetch<AuthResponse>(isRegistering ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body }),
    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_KEY, data.user);
      router.replace('/');
    },
  });

  const error = localError || (auth.error ? (auth.error instanceof ApiError ? auth.error.message : 'Erro ao conectar ao servidor') : '');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    if (!isRegistering) {
      auth.mutate({ username: username.trim(), password });
      return;
    }
    if (password !== confirmPassword) return setLocalError('As senhas não coincidem');
    // Mesmas regras do backend.
    if (password.length < 8) return setLocalError('A senha deve ter pelo menos 8 caracteres');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setLocalError('A senha deve conter letras e números');
    auth.mutate({ username: username.trim(), email: email.trim(), password });
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setLocalError('');
    auth.reset();
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17]">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F8CFF] to-blue-500 shadow-lg shadow-blue-500/30">
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M4 6 L12 12 L20 6" strokeLinecap="round" />
                  <path d="M4 12 L12 18 L20 12" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <h1 className="bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-2xl font-bold text-transparent">OrbNOC</h1>
            <p className="mt-1 text-sm text-slate-400">{isRegistering ? 'Crie sua conta para começar' : 'Network Operations Center'}</p>
          </div>

          <div className="rounded-xl border border-slate-600/70 bg-card p-6 shadow-2xl backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="tracking-wider uppercase">
                  Usuário{isRegistering ? '' : ' ou email'}
                </Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Digite seu usuário" autoComplete="username" required className="h-10 bg-slate-800" />
              </div>

              {isRegistering && (
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="tracking-wider uppercase">
                    Email
                  </Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" required className="h-10 bg-slate-800" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password" className="tracking-wider uppercase">
                  Senha
                </Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isRegistering ? 'new-password' : 'current-password'} required className="h-10 bg-slate-800" />
              </div>

              {isRegistering && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="tracking-wider uppercase">
                    Confirmar Senha
                  </Label>
                  <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required className="h-10 bg-slate-800" />
                </div>
              )}

              {error && (
                <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                  <p className="text-center text-sm text-rose-400">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={auth.isPending} className="mt-2 h-10 w-full bg-gradient-to-r from-[#4F8CFF] to-blue-500 hover:from-blue-500 hover:to-blue-400">
                {auth.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> {isRegistering ? 'Registrando...' : 'Entrando...'}
                  </>
                ) : isRegistering ? (
                  'Criar Conta'
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            {/* O registro só aparece quando o servidor permite (REGISTRATION_ENABLED). */}
            {registrationEnabled && (
              <div className="mt-5 text-center">
                <button type="button" onClick={toggleMode} className="text-sm text-slate-400 transition-colors hover:text-blue-300">
                  {isRegistering ? '← Voltar para o login' : 'Criar nova conta →'}
                </button>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            OrbNOC Network Operations Center © {YEAR} • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
          </p>
        </div>
      </div>
    </div>
  );
}
