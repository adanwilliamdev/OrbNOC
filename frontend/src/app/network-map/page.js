'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

const CustomNode = ({ data }) => {
  const statusColor = data.status === 'online' ? '#10b981' : '#ef4444';
  const statusText = data.status === 'online' ? 'ONLINE' : 'OFFLINE';

  return (
    <div className="relative group cursor-pointer">
      <div className="bg-gradient-to-br from-[#121a2b] to-slate-900 rounded-xl border-2 p-3 min-w-[140px] shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl" style={{ borderColor: statusColor }}>
        <div className="flex items-center gap-2 mb-2"><div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: statusColor }} /><span className="text-[10px] font-mono text-slate-400 truncate">{data.ip || '—'}</span></div>
        <p className="font-semibold text-slate-200 text-sm truncate">{data.label}</p>
        {data.latency && <p className="text-xs text-slate-400 mt-1">⚡ {data.latency}ms</p>}
        <div className="mt-2 pt-2 border-t border-slate-700/50"><span className={`text-[10px] font-medium`} style={{ color: statusColor }}>{statusText}</span></div>
      </div>
      {data.status === 'offline' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />}
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

export default function NetworkMap() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('hierarchical');
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => { const token = localStorage.getItem('token'); if (!token) { router.push('/login'); return; } fetchDevices(); }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setDevices(data); generateTopology(data); }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const generateTopology = (devicesList) => {
    const onlineDevices = devicesList.filter(d => d.status === 'online');
    const offlineDevices = devicesList.filter(d => d.status === 'offline');
    const allDevices = [...onlineDevices, ...offlineDevices];
    const newNodes = []; const newEdges = [];
    const availability = devicesList.length ? Math.round((onlineDevices.length / devicesList.length) * 100) : 0;
    newNodes.push({ id: 'core', type: 'custom', position: { x: 400, y: 50 }, data: { label: '🌐 Core / Internet', ip: 'Gateway Principal', status: availability >= 50 ? 'online' : 'offline', latency: null }, style: { zIndex: 10 } });
    allDevices.forEach((device, index) => {
      let x, y;
      if (viewMode === 'hierarchical') { const col = index % 4; const row = Math.floor(index / 4); x = 120 + col * 190; y = 220 + row * 110; }
      else if (viewMode === 'radial') { const angle = (index / allDevices.length) * 2 * Math.PI; const radius = 220; const centerX = 400; const centerY = 280; x = centerX + radius * Math.cos(angle); y = centerY + radius * Math.sin(angle); }
      else { const cols = Math.ceil(Math.sqrt(allDevices.length)); const col = index % cols; const row = Math.floor(index / cols); x = 80 + col * 210; y = 180 + row * 120; }
      newNodes.push({ id: device.id.toString(), type: 'custom', position: { x, y }, data: { label: device.name, ip: device.ip, status: device.status, latency: device.latency } });
      newEdges.push({ id: `edge-core-${device.id}`, source: 'core', target: device.id.toString(), type: 'smoothstep', animated: device.status === 'online', style: { stroke: device.status === 'online' ? '#10b981' : '#ef4444', strokeWidth: 2, strokeDasharray: device.status === 'offline' ? '5,5' : 'none' }, markerEnd: { type: MarkerType.ArrowClosed, color: device.status === 'online' ? '#10b981' : '#ef4444' } });
    });
    setNodes(newNodes); setEdges(newEdges);
  };

  useEffect(() => { if (devices.length > 0) generateTopology(devices); }, [viewMode, devices]);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const onNodeClick = (event, node) => { setSelectedNode(node); setTimeout(() => setSelectedNode(null), 4000); };
  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const availability = devices.length ? Math.round((online / devices.length) * 100) : 0;

  if (loading) return (<div className="min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17] flex items-center justify-center"><div className="text-center"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" /><p className="text-slate-400 mt-3 text-sm">Carregando mapa de rede...</p></div></div>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17]">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div><h1 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2"><span className="text-3xl">🗺️</span> Mapa de Rede</h1><p className="text-sm text-slate-400 mt-1">Visualização topológica da infraestrutura em tempo real</p></div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-slate-800/30 rounded-lg p-1 border border-slate-600/70">
              <button onClick={() => setViewMode('hierarchical')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'hierarchical' ? 'bg-[#4F8CFF] text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>🌳 Hierárquico</button>
              <button onClick={() => setViewMode('radial')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'radial' ? 'bg-[#4F8CFF] text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>🕸️ Radial</button>
              <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-[#4F8CFF] text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>📐 Grade</button>
            </div>
            <button onClick={() => router.push('/')} className="px-3 py-2 bg-[#121a2b] hover:bg-slate-700 rounded-lg text-sm transition-all border border-slate-600/70 text-slate-400 hover:text-white flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Voltar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-xl border border-slate-600/70 p-4 text-center"><p className="text-3xl font-bold text-emerald-300">{online}</p><p className="text-xs text-slate-400 mt-1">🟢 ONLINE</p></div>
          <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-xl border border-slate-600/70 p-4 text-center"><p className="text-3xl font-bold text-rose-400">{offline}</p><p className="text-xs text-slate-400 mt-1">🔴 OFFLINE</p></div>
          <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-xl border border-slate-600/70 p-4 text-center"><p className="text-3xl font-bold text-blue-300">{availability}%</p><p className="text-xs text-slate-400 mt-1">📊 DISPONIBILIDADE</p></div>
          <div className="bg-gradient-to-br from-[#121a2b] to-slate-900/50 rounded-xl border border-slate-600/70 p-4 text-center"><p className="text-3xl font-bold text-indigo-400">{devices.length}</p><p className="text-xs text-slate-400 mt-1">🖥️ TOTAL</p></div>
        </div>

        <div className="bg-slate-800/20 rounded-xl border border-slate-600/70 overflow-hidden shadow-2xl"><div style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView attributionPosition="bottom-right">
            <Background color="#1e293b" gap={20} size={0.5} />
            <Controls className="bg-[#121a2b] border border-slate-600/70 rounded-lg shadow-lg [&>button]:bg-[#121a2b] [&>button]:border-slate-600/70 [&>button]:text-slate-400 [&>button:hover]:bg-slate-700 [&>button:hover]:text-white" />
            <MiniMap className="bg-[#121a2b] border border-slate-600/70 rounded-lg shadow-lg" nodeColor={(node) => { if (node.id === 'core') return '#3b82f6'; return node.data?.status === 'online' ? '#10b981' : '#ef4444'; }} maskColor="rgba(0, 0, 0, 0.6)" />
          </ReactFlow>
        </div></div>

        <div className="mt-4 flex flex-wrap justify-center gap-6 text-xs">
          <div className="flex items-center gap-2 bg-[#121a2b] px-3 py-1.5 rounded-full border border-slate-600/70"><div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" /><span className="text-slate-400">Online</span></div>
          <div className="flex items-center gap-2 bg-[#121a2b] px-3 py-1.5 rounded-full border border-slate-600/70"><div className="w-3 h-3 rounded-full bg-rose-500" /><span className="text-slate-400">Offline</span></div>
          <div className="flex items-center gap-2 bg-[#121a2b] px-3 py-1.5 rounded-full border border-slate-600/70"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-slate-400">Core/Gateway</span></div>
          <div className="flex items-center gap-2 bg-[#121a2b] px-3 py-1.5 rounded-full border border-slate-600/70"><div className="w-3 h-3 rounded-full border border-dashed border-emerald-500" /><span className="text-slate-400">Conexão ativa</span></div>
        </div>

        {selectedNode && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#121a2b] rounded-xl shadow-2xl border border-slate-600/70 p-4 z-50 animate-fade-in min-w-[220px]">
            <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${selectedNode.data.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} /><div className="flex-1"><p className="text-sm font-semibold text-slate-200">{selectedNode.data.label}</p><p className="text-xs text-slate-400 font-mono">{selectedNode.data.ip}</p>{selectedNode.data.latency && <p className="text-xs text-yellow-300 mt-1">⚡ Latência: {selectedNode.data.latency}ms</p>}</div><button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-300 transition-colors">✕</button></div>
            <div className="mt-2 pt-2 border-t border-slate-600/70"><p className={`text-[10px] font-medium ${selectedNode.data.status === 'online' ? 'text-emerald-300' : 'text-rose-400'}`}>{selectedNode.data.status === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}</p></div>
          </div>
        )}

        <footer className="mt-6 pt-4 border-t border-slate-600/70 text-center text-xs text-slate-400">
          OrbNOC Network Operations Center © 2026 • Desenvolvido por <span className="text-blue-300">Adan W O Santos</span>
        </footer>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}