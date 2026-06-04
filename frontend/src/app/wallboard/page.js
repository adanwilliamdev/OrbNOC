'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

export default function Wallboard() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showExitButton, setShowExitButton] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchDevices();
    const interval = setInterval(() => { fetchDevices(); setLastUpdate(new Date()); }, 10000);

    // Mostrar botão de saída após mover o mouse
    const timer = setTimeout(() => setShowExitButton(true), 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setDevices(await res.json());
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const availability = devices.length > 0 ? Math.round((online / devices.length) * 100) : 0;

  // Função para sair do wallboard
  const exitWallboard = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-4 text-sm">Carregando Wallboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Botão de saída - aparece ao passar o mouse no canto superior direito */}
      <div
        className="fixed top-4 right-4 z-50 transition-all duration-300"
        onMouseEnter={() => setShowExitButton(true)}
        onMouseLeave={() => setShowExitButton(false)}
      >
        <button
          onClick={exitWallboard}
          className={`px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 backdrop-blur-sm shadow-lg ${
            showExitButton ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Sair do Wallboard
        </button>
      </div>

      <div className="h-screen flex flex-col p-8">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            OrbNOC Wallboard
          </h1>
          <p className="text-xl text-slate-500 mt-2">Network Operations Center</p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="text-center">
            <div className="text-9xl font-bold text-emerald-400">{online}</div>
            <p className="text-3xl text-slate-400 mt-2">ONLINE</p>
          </div>
          <div className="text-center">
            <div className="text-9xl font-bold text-blue-400">{availability}%</div>
            <p className="text-3xl text-slate-400 mt-2">DISPONIBILIDADE</p>
          </div>
          <div className="text-center">
            <div className="text-9xl font-bold text-rose-400">{offline}</div>
            <p className="text-3xl text-slate-400 mt-2">OFFLINE</p>
          </div>
        </div>

        {offline > 0 && (
          <div className="mt-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-rose-400 mb-4">⚠️ HOSTS OFFLINE</h3>
            <div className="flex flex-wrap gap-3">
              {devices.filter(d => d.status === 'offline').map(device => (
                <div key={device.id} className="bg-rose-500/20 rounded-lg px-4 py-2">
                  <span className="text-rose-300">{device.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-slate-500 text-sm mt-8">
          Última atualização: {lastUpdate.toLocaleTimeString()}
        </div>

        <footer className="mt-4 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
          OrbNOC Network Operations Center © 2026 • Desenvolvido por <span className="text-blue-400">Adan W O Santos</span>
          <br />
          <span className="text-slate-600">Mova o mouse para o canto superior direito para sair</span>
        </footer>
      </div>
    </div>
  );
}