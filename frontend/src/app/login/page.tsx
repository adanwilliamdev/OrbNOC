'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size="lg" />
          <h1 className="mt-5 text-2xl font-semibold text-foreground">OrbNOC</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isRegistering ? 'Crie sua conta para começar' : 'Entre para acompanhar a sua rede'}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-pop">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Usuário{isRegistering ? '' : ' ou email'}</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Digite seu usuário" autoComplete="username" required className="h-10" />
            </div>

            {isRegistering && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" required className="h-10" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isRegistering ? 'new-password' : 'current-password'} required className="h-10" />
            </div>

            {isRegistering && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required className="h-10" />
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-bad/25 bg-bad/10 p-3">
                <p className="text-center text-sm text-bad">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={auth.isPending} size="lg" className="mt-2 w-full">
              {auth.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> {isRegistering ? 'Registrando...' : 'Entrando...'}
                </>
              ) : isRegistering ? (
                'Criar conta'
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* O registro só aparece quando o servidor permite (REGISTRATION_ENABLED). */}
          {registrationEnabled && (
            <div className="mt-5 text-center">
              <button type="button" onClick={toggleMode} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                {isRegistering ? 'Já tenho conta. Voltar ao login' : 'Criar nova conta'}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">
          OrbNOC © {YEAR}. Desenvolvido por Adan W O Santos
        </p>
      </div>
    </div>
  );
}
