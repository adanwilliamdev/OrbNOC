'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/dashboard/LoadingScreen';
import { useSession } from '@/lib/session';
import { StreamProvider } from '@/providers/stream-provider';

/** Guarda de sessão + WebSocket compartilhado por todas as páginas autenticadas. */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading, error } = useSession();

  useEffect(() => {
    if (!isLoading && user === null) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || user === null) return <LoadingScreen />;
  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-bad" role="alert">
        Não foi possível falar com o servidor. Recarregue a página em instantes.
      </div>
    );
  }
  return <StreamProvider>{children}</StreamProvider>;
}
