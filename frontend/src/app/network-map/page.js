'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';

// Componente de nó personalizado
const CustomNode = ({ data }) => {
  const statusColor = data.status === 'online' ? '#10b981' : '#ef4444';
  const statusText = data.status === 'online' ? 'ONLINE' : 'OFFLINE';

  return (
    <div className="relative">
      <div className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border-2 p-3 min-w-[140px] shadow-lg transition-all hover:scale-105`}
           style={{ borderColor: statusColor }}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: statusColor }}></div>
          <span className="text-xs font-mono text-slate-400">{data.ip || '—'}</span>
        </div>
        <p className="font-semibold text-slate-200 text-sm truncate">{data.label}</p>
        {data.latency && (
          <p className="text-xs text-slate-400 mt-1">⚡ {data.latency}ms</p>
        )}
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <span className={`text-[10px] font-medium`} style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>
      </div>
      {data.status === 'offline' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
      )}
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

export default function NetworkMap() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('hierarchical'); // hierarchical, radial, grid
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
        generateTopology(data);
      }
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTopology = (devicesList) => {
    const onlineDevices = devicesList.filter(d => d.status === 'online');
    const offlineDevices = devicesList.filter(d => d.status === 'offline');
    const allDevices = [...onlineDevices, ...offlineDevices];

    const newNodes = [];
    const newEdges = [];

    // Nó central (Core/Internet)
    const onlineCount = onlineDevices.length;
    const offlineCount = offlineDevices.length;
    const availability = devicesList.length ? Math.round((onlineCount / devicesList.length) * 100) : 0;

    newNodes.push({
      id: 'core',
      type: 'custom',
      position: { x: 400, y: 50 },
      data: {
        label: '🌐 Core / Internet',
        ip: 'Gateway',
        status: availability >= 50 ? 'online' : 'offline',
        latency: null
      },
      style: { zIndex: 10 }
    });

    // Layout dos dispositivos
    const radius = 200;
    const centerX = 400;
    const centerY = 280;

    allDevices.forEach((device, index) => {
      let x, y;

      if (viewMode === 'hierarchical') {
        const col = index % 4;
        const row = Math.floor(index / 4);
        x = 150 + col * 180;
        y = 250 + row * 100;
      } else if (viewMode === 'radial') {
        const angle = (index / allDevices.length) * 2 * Math.PI;
        x = centerX + radius * Math.cos(angle);
        y = centerY + radius * Math.sin(angle);
      } else {
        const cols = Math.ceil(Math.sqrt(allDevices.length));
        const col = index % cols;
        const row = Math.floor(index / cols);
        x = 100 + col * 200;
        y = 200 + row * 100;
      }

      newNodes.push({
        id: device.id.toString(),
        type: 'custom',
        position: { x, y },
        data: {
          label: device.name,
          ip: device.ip,
          status: device.status,
          latency: device.latency
        }
      });

      // Conexão com o core
      newEdges.push({
        id: `edge-core-${device.id}`,
        source: 'core',
        target: device.id.toString(),
        type: 'smoothstep',
        animated: device.status === 'online',
        style: { stroke: device.status === 'online' ? '#10b981' : '#ef4444', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  useEffect(() => {
    if (devices.length > 0) {
      generateTopology(devices);
    }
  }, [viewMode, devices]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
    setTimeout(() => setSelectedNode(null), 3000);
  };

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const availability = devices.length ? Math.round((online / devices.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-3 text-sm">Carregando mapa de rede...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              🗺️ Mapa de Rede
            </h1>
            <p className="text-sm text-slate-500 mt-1">Visualização topológica da infraestrutura</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Selector */}
            <div className="flex gap-1 bg-slate-800/30 rounded-lg p-1">
              <button
                onClick={() => setViewMode('hierarchical')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'hierarchical' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hierárquico
              </button>
              <button
                onClick={() => setViewMode('radial')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'radial' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Radial
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Grade
              </button>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-all"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{online}</p>
            <p className="text-xs text-slate-500">ONLINE</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-rose-400">{offline}</p>
            <p className="text-xs text-slate-500">OFFLINE</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{availability}%</p>
            <p className="text-xs text-slate-500">DISPONIBILIDADE</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-400">{devices.length}</p>
            <p className="text-xs text-slate-500">TOTAL</p>
          </div>
        </div>

        {/* React Flow Container */}
        <div className="bg-slate-900/30 rounded-xl border border-slate-800 overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
          >
            <Background color="#334155" gap={16} size={0.5} />
            <Controls className="bg-slate-800 border-slate-700 rounded-lg" />
            <MiniMap
              className="bg-slate-900 border border-slate-700 rounded-lg"
              nodeColor={(node) => {
                if (node.id === 'core') return '#3b82f6';
                return node.data?.status === 'online' ? '#10b981' : '#ef4444';
              }}
            />
          </ReactFlow>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-slate-400">Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-slate-400">Core/Gateway</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-dashed border-emerald-500" />
            <span className="text-slate-400">Conexão ativa</span>
          </div>
        </div>

        {/* Tooltip para nó selecionado */}
        {selectedNode && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-3 z-50 animate-fade-in">
            <p className="text-sm font-medium text-slate-200">{selectedNode.data.label}</p>
            <p className="text-xs text-slate-400">{selectedNode.data.ip}</p>
            <p className={`text-xs mt-1 ${selectedNode.data.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {selectedNode.data.status === 'online' ? '🟢 Online' : '🔴 Offline'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}