'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../config';


export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
      } else {
        setError(data.error || 'Credenciais inválidas');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
      } else {
        setError(data.error || 'Erro ao registrar');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17] font-sans">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-5">
              <div className="w-14 h-14 bg-gradient-to-br from-[#4F8CFF] to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 6 L12 12 L20 6" strokeLinecap="round"/>
                  <path d="M4 12 L12 18 L20 12" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent">
              OrbNOC
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {isRegistering ? 'Crie sua conta para começar' : 'Network Operations Center'}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-xl bg-[#121a2b] backdrop-blur-sm border border-slate-600/70 p-6 shadow-2xl">
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider mb-1.5 text-slate-400">Usuário</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-800 border border-slate-600/70 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Digite seu usuário" required />
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider mb-1.5 text-slate-400">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-600/70 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all" placeholder="seu@email.com" required />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider mb-1.5 text-slate-400">Senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-600/70 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all" placeholder="••••••••" required />
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider mb-1.5 text-slate-400">Confirmar Senha</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-600/70 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all" placeholder="••••••••" required />
                </div>
              )}

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                  <p className="text-rose-400 text-sm text-center">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#4F8CFF] to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-blue-500/20">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isRegistering ? 'Registrando...' : 'Entrando...'}
                  </span>
                ) : (isRegistering ? 'Criar Conta' : 'Entrar')}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button onClick={() => { setIsRegistering(!isRegistering); setError(''); setUsername(''); setPassword(''); setEmail(''); setConfirmPassword(''); }} className="text-sm text-slate-400 hover:text-blue-300 transition-colors">
                {isRegistering ? '← Voltar para o login' : 'Criar nova conta →'}
              </button>
            </div>

            {!isRegistering && (
              <div className="mt-5 pt-4 border-t border-slate-600/70 text-center">
                <p className="text-xs text-slate-400">
                  <span className="text-slate-300">Demo:</span>{' '}
                  <span className="font-mono text-emerald-300">admin</span>
                  <span className="text-slate-500 mx-1">/</span>
                  <span className="font-mono text-emerald-300">admin123</span>
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            OrbNOC Network Operations Center © {new Date().getFullYear()} • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
          </p>
        </div>
      </div>
    </div>
  );
}