'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
      const res = await fetch('http://localhost:3001/api/auth/login', {
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
      const res = await fetch('http://localhost:3001/api/auth/register', {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans">

      {/* Container Principal */}
      <div className="flex min-h-screen items-center justify-center p-4">

        {/* Card de Login/Registro */}
        <div className="w-full max-w-md">

          {/* Logo e Título com Ícone Animado */}
          <div className="text-center mb-8">
            {/* Ícone de Rede Animado */}
            <div className="inline-flex items-center justify-center w-20 h-20 mb-5 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
                <div className="relative w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Padrão ╱╲╱╲╱╲ - Linhas diagonais animadas */}
                    <g>
                      <line x1="4" y1="6" x2="10" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-1"/>
                      <line x1="10" y1="12" x2="4" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-2"/>
                      <line x1="12" y1="8" x2="18" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-3"/>
                      <line x1="18" y1="14" x2="12" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-4"/>
                      <line x1="8" y1="4" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" className="animate-line-5"/>
                      <line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" className="animate-line-6"/>

                      {/* Pontos de conexão pulsantes */}
                      <circle cx="10" cy="12" r="1.5" fill="currentColor" className="animate-pulse-dot"/>
                      <circle cx="18" cy="14" r="1.5" fill="currentColor" className="animate-pulse-dot delay-100"/>
                      <circle cx="4" cy="18" r="1" fill="currentColor" className="animate-pulse-dot delay-200"/>
                      <circle cx="12" cy="20" r="1" fill="currentColor" className="animate-pulse-dot delay-300"/>
                    </g>
                  </svg>

                  {/* Efeito de brilho */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"></div>
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              OrbNOC Systems
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              {isRegistering ? 'Crie sua conta para começar' : 'Network Operations Center'}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm shadow-xl p-8">

            {/* Formulário */}
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">

              {/* Usuário */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-400">
                  Usuário
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="Digite seu usuário"
                  required
                />
              </div>

              {/* Email (apenas registro) */}
              {isRegistering && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              )}

              {/* Senha */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-400">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Confirmar Senha (apenas registro) */}
              {isRegistering && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-400">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              {/* Mensagem de Erro */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 animate-fade-in">
                  <p className="text-rose-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Botão Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-indigo-500/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isRegistering ? 'Registrando...' : 'Entrando...'}
                  </span>
                ) : (
                  isRegistering ? 'Criar Conta' : 'Entrar no Dashboard'
                )}
              </button>
            </form>

            {/* Link para alternar entre Login/Registro */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                  setUsername('');
                  setPassword('');
                  setEmail('');
                  setConfirmPassword('');
                }}
                className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {isRegistering ? '← Voltar para o login' : 'Criar nova conta →'}
              </button>
            </div>

            {/* Demo Credentials */}
            {!isRegistering && (
              <div className="mt-6 pt-6 border-t border-slate-800/50 text-center">
                <p className="text-xs text-slate-500">
                  <span className="text-slate-400">Credenciais de demonstração:</span>
                  <br />
                  <span className="font-mono text-emerald-400">admin</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="font-mono text-emerald-400">admin123</span>
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-500 mt-8">
            OrbNOC Systems © {new Date().getFullYear()} • Network Operations Center
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes line-draw {
          0% {
            stroke-dasharray: 30;
            stroke-dashoffset: 30;
            opacity: 0;
          }
          20% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          80% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes pulse-dot {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(0.5);
          }
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(100%) skewX(-12deg);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-line-1 {
          animation: line-draw 3s ease-in-out infinite;
        }

        .animate-line-2 {
          animation: line-draw 3s ease-in-out infinite 0.3s;
        }

        .animate-line-3 {
          animation: line-draw 3s ease-in-out infinite 0.6s;
        }

        .animate-line-4 {
          animation: line-draw 3s ease-in-out infinite 0.9s;
        }

        .animate-line-5 {
          animation: line-draw 4s ease-in-out infinite 1.2s;
        }

        .animate-line-6 {
          animation: line-draw 4s ease-in-out infinite 1.5s;
        }

        .animate-pulse-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        .delay-100 {
          animation-delay: 0.5s;
        }

        .delay-200 {
          animation-delay: 1s;
        }

        .delay-300 {
          animation-delay: 1.5s;
        }

        .animate-shine {
          animation: shine 3s infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}