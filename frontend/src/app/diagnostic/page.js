'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

export default function DiagnosticPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ping');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [host, setHost] = useState('google.com');
  const [port, setPort] = useState('443');
  const [domain, setDomain] = useState('google.com');
  const [recordType, setRecordType] = useState('A');

  const getToken = () => localStorage.getItem('token');

  const checkAuth = () => { const token = getToken(); if (!token) { router.push('/login'); return false; } return true; };

  const runPing = async () => { if (!checkAuth()) return; setLoading(true); try { const res = await fetch(`${API_BASE_URL}/api/diagnostic/ping`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ host, count: 5 }) }); setResults(await res.json()); } catch (error) { setResults({ error: error.message }); } setLoading(false); };
  const runTraceroute = async () => { if (!checkAuth()) return; setLoading(true); try { const res = await fetch(`${API_BASE_URL}/api/diagnostic/traceroute`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ host }) }); setResults(await res.json()); } catch (error) { setResults({ error: error.message }); } setLoading(false); };
  const runPortCheck = async () => { if (!checkAuth()) return; setLoading(true); try { const res = await fetch(`${API_BASE_URL}/api/diagnostic/port-check`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ host, port: parseInt(port) }) }); setResults(await res.json()); } catch (error) { setResults({ error: error.message }); } setLoading(false); };
  const runDNSLookup = async () => { if (!checkAuth()) return; setLoading(true); try { const res = await fetch(`${API_BASE_URL}/api/diagnostic/dns-lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ domain, recordType }) }); setResults(await res.json()); } catch (error) { setResults({ error: error.message }); } setLoading(false); };
  const runFullDiagnostic = async () => { if (!checkAuth()) return; setLoading(true); try { const res = await fetch(`${API_BASE_URL}/api/diagnostic/full-diagnostic`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ host, ports: [80, 443, 22] }) }); setResults(await res.json()); } catch (error) { setResults({ error: error.message }); } setLoading(false); };

  const renderResults = () => {
    if (!results) return null;
    if (results.error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400">{results.error}</div>;
    switch (activeTab) {
      case 'ping': return (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Status</p><p className={`text-lg font-bold ${results.status === 'online' ? 'text-emerald-300' : 'text-rose-400'}`}>{results.status === 'online' ? '✅ ONLINE' : '❌ OFFLINE'}</p></div><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Perda de Pacotes</p><p className="text-lg font-bold text-yellow-300">{results.packet_loss}%</p></div><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Latência Média</p><p className="text-lg font-bold text-blue-300">{results.avg_latency || '—'}ms</p></div><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Mín/Máx</p><p className="text-sm text-slate-300">{results.min_latency || '—'} / {results.max_latency || '—'} ms</p></div></div><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400 mb-2">Resultado dos pings</p><p className="text-sm text-slate-300">Sucesso: {results.success_count}/{results.total_count}</p></div></div>);
      case 'traceroute': return (<div className="space-y-2 max-h-96 overflow-y-auto"><p className="text-xs text-slate-400 mb-2">Caminho até {host}</p>{results.hops?.map((hop, idx) => (<div key={idx} className="bg-[#121a2b] rounded-lg p-2 flex items-center gap-3"><span className="text-xs text-slate-400 w-8">#{hop.hop}</span><span className="font-mono text-sm text-slate-300 flex-1">{hop.ip}</span><span className={`text-xs ${hop.latency ? 'text-emerald-300' : 'text-rose-400'}`}>{hop.latency ? `${hop.latency}ms` : 'timeout'}</span></div>))}</div>);
      case 'port': return (<div className="space-y-3"><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Teste de Porta</p>{results.results?.map((r, idx) => (<div key={idx} className="flex items-center justify-between py-2 border-b border-slate-600/70 last:border-0"><span className="font-mono text-slate-300">Porta {r.port}</span><span className={r.open ? 'text-emerald-300' : 'text-rose-400'}>{r.open ? '✅ Aberta' : '❌ Fechada'}</span>{r.latency && <span className="text-xs text-slate-400">{r.latency}ms</span>}</div>))}</div></div>);
      case 'dns': return (<div className="space-y-3"><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Registros {recordType}</p>{results.records?.map((record, idx) => (<div key={idx} className="font-mono text-sm text-emerald-300 py-1">{record.value || record}</div>))}{results.reverse_lookup && (<div className="mt-2 pt-2 border-t border-slate-600/70"><p className="text-xs text-slate-400">PTR (Reverse)</p><p className="font-mono text-sm text-yellow-300">{results.reverse_lookup}</p></div>)}{!results.success && <p className="text-rose-400 text-sm">{results.error}</p>}</div></div>);
      case 'full': return (<div className="space-y-3"><div className="bg-[#121a2b] rounded-lg p-3"><p className="text-xs text-slate-400">Diagnóstico Inteligente</p><p className="text-sm text-slate-300 mt-2">{results.diagnosis}</p><p className="text-xs text-slate-400 mt-2">Tempo total: {results.duration_ms}ms</p></div></div>);
      default: return null;
    }
  };

  const tabs = [{ id: 'ping', name: '📡 Ping', action: runPing }, { id: 'traceroute', name: '🗺️ Traceroute', action: runTraceroute }, { id: 'port', name: '🔌 Portas', action: runPortCheck }, { id: 'dns', name: '🌐 DNS', action: runDNSLookup }, { id: 'full', name: '🔍 Diagnóstico Completo', action: runFullDiagnostic }];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17]">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8"><div><h1 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2"><span className="text-3xl">🔧</span> Diagnóstico Avançado</h1><p className="text-sm text-slate-400 mt-1">Ferramentas de rede para troubleshooting</p></div><button onClick={() => router.push('/')} className="px-4 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-xl text-sm transition-all border border-slate-600/70 text-slate-400 hover:text-white">← Voltar ao Dashboard</button></div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-600/70 p-5 mb-6"><div className="flex flex-wrap gap-4 items-end"><div className="flex-1"><label className="block text-xs font-semibold text-slate-400 mb-1">{activeTab === 'dns' ? 'Domínio' : 'Host / IP'}</label><input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder={activeTab === 'dns' ? 'exemplo.com' : '8.8.8.8 ou google.com'} className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500" /></div>{activeTab === 'port' && (<div className="w-32"><label className="block text-xs font-semibold text-slate-400 mb-1">Porta</label><input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500" /></div>)}{activeTab === 'dns' && (<div className="w-32"><label className="block text-xs font-semibold text-slate-400 mb-1">Tipo</label><select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200"><option value="A">A (IPv4)</option><option value="AAAA">AAAA (IPv6)</option><option value="MX">MX (Email)</option><option value="TXT">TXT</option><option value="CNAME">CNAME</option></select></div>)}<div>{tabs.find(t => t.id === activeTab) && (<button onClick={tabs.find(t => t.id === activeTab).action} disabled={loading} className="px-6 py-2 bg-gradient-to-r from-[#4F8CFF] to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-lg transition-all disabled:opacity-50">{loading ? '⏳ Executando...' : '▶ Executar'}</button>)}</div></div></div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-600/70 pb-2">{tabs.map(tab => (<button key={tab.id} onClick={() => { setActiveTab(tab.id); setResults(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300 hover:bg-[#121a2b]'}`}>{tab.name}</button>))}</div>

        {results && (<div className="bg-slate-800/30 rounded-xl border border-slate-600/70 p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold text-slate-300">Resultado</h3><button onClick={() => setResults(null)} className="text-xs text-slate-400 hover:text-slate-300">Limpar</button></div>{renderResults()}</div>)}

        <div className="mt-6 text-center text-xs text-slate-400">💡 Dica: Use o Diagnóstico Completo para uma análise rápida do problema</div>

        <footer className="mt-8 pt-4 border-t border-slate-600/70 text-center text-xs text-slate-400">
          OrbNOC Network Operations Center © 2026 • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
        </footer>
      </div>
    </div>
  );
}