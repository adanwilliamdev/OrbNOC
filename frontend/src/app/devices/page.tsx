export const dynamic = 'force-dynamic';
export const revalidate = 0;

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchDevices();
  }, [router]);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-200 mb-6">Meus Dispositivos</h1>
        <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-slate-400">Nome</th>
                <th className="px-4 py-3 text-left text-slate-400">IP</th>
                <th className="px-4 py-3 text-left text-slate-400">Latência</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-b border-slate-800/50">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${device.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {device.status === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{device.name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-sm">{device.ip}</td>
                  <td className="px-4 py-3 text-slate-300">{device.latency ? `${device.latency}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}