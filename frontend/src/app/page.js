'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React, { useEffect, useState, useRef, Fragment, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';
const WS_BASE_URL = 'wss://orbnoc-backend-nmlq.onrender.com';

export default function Home() {
  const router = useRouter();
  const dashboardRef = useRef(null);

  // States principais
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState([]);
  const [alertSound, setAlertSound] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [user, setUser] = useState(null);
  const [pingingDevice, setPingingDevice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('status');
  const [sortDirection, setSortDirection] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [alertThresholds, setAlertThresholds] = useState({});
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [selectedAlertDevice, setSelectedAlertDevice] = useState(null);
  const [realtimeLatencyData, setRealtimeLatencyData] = useState({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [emailConfig, setEmailConfig] = useState({ enabled: false, email: '' });
  const [telegramConfig, setTelegramConfig] = useState({ enabled: false, botToken: '', chatId: '' });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filtros avançados
  const [filters, setFilters] = useState({
    minLatency: '',
    maxLatency: '',
    minUptime: '',
    tags: []
  });

  // Tendência de latência
  const [latencyTrend, setLatencyTrend] = useState({ value: 0, percentage: 0, direction: 'stable' });
  const [previousAvgLatency, setPreviousAvgLatency] = useState(0);

  const alertThresholdsRef = useRef(alertThresholds);
  const devicesRef = useRef(devices);

  // Refs para evitar loop infinito
  useEffect(() => { alertThresholdsRef.current = alertThresholds; }, [alertThresholds]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // Click outside handler para dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showExportMenu && !e.target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

  // Calcular tendência de latência
  useEffect(() => {
    if (devices.length > 0) {
      const currentAvg = devices.filter(d => d.status === 'online' && d.latency).length > 0
        ? devices.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + d.latency, 0) / devices.filter(d => d.status === 'online' && d.latency).length
        : 0;

      if (previousAvgLatency > 0 && currentAvg > 0) {
        const percentageChange = ((currentAvg - previousAvgLatency) / previousAvgLatency) * 100;
        setLatencyTrend({
          value: Math.round(Math.abs(currentAvg - previousAvgLatency)),
          percentage: Math.abs(Math.round(percentageChange)),
          direction: percentageChange < 0 ? 'down' : percentageChange > 0 ? 'up' : 'stable'
        });
      }
      setPreviousAvgLatency(currentAvg);
    }
  }, [devices, previousAvgLatency]);

  const addAlert = (message, type) => {
    const newAlert = { id: Date.now(), message, type, timestamp: new Date().toLocaleTimeString(), read: false };
    setAlertHistory(prev => {
      const updated = [newAlert, ...prev].slice(0, 50);
      if (user?.id) localStorage.setItem(`orbnoc_alert_history_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    setAlertMessage(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 4000);
    playAlertSound(type);
  };

  const clearAlertHistory = () => {
    if (confirm('Limpar todo o histórico de alertas?')) {
      setAlertHistory([]);
      if (user?.id) localStorage.setItem(`orbnoc_alert_history_${user.id}`, JSON.stringify([]));
      addAlert('Histórico de alertas limpo', 'success');
    }
  };

  const playAlertSound = (type) => {
    if (!alertSound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = type === 'error' ? 'sawtooth' : type === 'warning' ? 'square' : 'sine';
      oscillator.frequency.value = type === 'error' ? 440 : type === 'warning' ? 660 : 880;
      gainNode.gain.value = 0.3;
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
      oscillator.stop(audioCtx.currentTime + 0.5);
      setTimeout(() => audioCtx.close(), 600);
    } catch (e) {}
  };

  const configureAlert = (deviceId, threshold) => {
    const newThresholds = { ...alertThresholds, [deviceId]: threshold };
    setAlertThresholds(newThresholds);
    localStorage.setItem(`orbnoc_thresholds_${user?.id}`, JSON.stringify(newThresholds));
    addAlert(`🔔 Alerta configurado: limite de ${threshold}ms`, 'success');
    setShowAlertConfig(false);
    setSelectedAlertDevice(null);
  };

  const removeAlertConfig = (deviceId) => {
    const newThresholds = { ...alertThresholds };
    delete newThresholds[deviceId];
    setAlertThresholds(newThresholds);
    localStorage.setItem(`orbnoc_thresholds_${user?.id}`, JSON.stringify(newThresholds));
    addAlert(`🔕 Alerta removido`, 'success');
  };

  const saveToHistory = (devicesList) => {
    const timestamp = new Date().toLocaleString();
    const online = devicesList.filter(d => d.status === 'online').length;
    const offline = devicesList.filter(d => d.status === 'offline').length;
    const avgLatency = devicesList.filter(d => d.status === 'online' && d.latency).length > 0
      ? devicesList.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + d.latency, 0) / devicesList.filter(d => d.status === 'online' && d.latency).length
      : 0;
    const newEntry = { timestamp, online, offline, total: devicesList.length, uptime: devicesList.length > 0 ? Math.round((online / devicesList.length) * 100) : 0, avgLatency: Math.round(avgLatency) };
    setHistory(prev => [newEntry, ...prev].slice(0, 50));
    const savedHistory = localStorage.getItem(`orbnoc_history_${user?.id}`);
    const historyArray = savedHistory ? JSON.parse(savedHistory) : [];
    historyArray.unshift(newEntry);
    localStorage.setItem(`orbnoc_history_${user?.id}`, JSON.stringify(historyArray.slice(0, 50)));
  };

  const getChartData = () => {
    const statusData = [
      { name: 'Online', value: devices.filter(d => d.status === 'online').length, color: '#10b981' },
      { name: 'Offline', value: devices.filter(d => d.status === 'offline').length, color: '#ef4444' }
    ];
    const timelineData = history.slice(0, 20).reverse().map(h => ({
      time: h.timestamp.split(' ')[1]?.slice(0, 5) || h.timestamp,
      online: h.online,
      offline: h.offline,
      uptime: h.uptime
    }));
    return { statusData, timelineData };
  };

  const generatePDF = async () => {
    if (typeof window === 'undefined') return;
    setIsGeneratingPDF(true);
    setShowExportMenu(false);
    try {
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const element = dashboardRef.current;
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0f172a', logging: false, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
      pdf.save(`orbnoc-report-${new Date().toISOString().split('T')[0]}.pdf`);
      addAlert('📄 Relatório PDF exportado!', 'success');
    } catch (error) {
      addAlert('❌ Erro ao gerar PDF', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const loadTelegramConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/alerts/telegram`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const config = await response.json();
        setTelegramConfig({
          enabled: config.enabled || false,
          botToken: config.botToken || '',
          chatId: config.chatId || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar config Telegram:', error);
    }
  };

  const loadEmailConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/alerts/email`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const config = await response.json();
        setEmailConfig(config);
      }
    } catch (error) {
      console.error('Erro ao carregar config Email:', error);
    }
  };

  const saveTelegramConfig = async (enabled, botToken, chatId) => {
    setSavingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/alerts/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled, botToken, chatId })
      });

      if (response.ok) {
        setTelegramConfig({ enabled, botToken, chatId });
        addAlert(enabled ? '✅ Telegram configurado com sucesso!' : '❌ Telegram desativado', enabled ? 'success' : 'warning');
      } else {
        addAlert(`❌ Erro ao salvar configuração`, 'error');
      }
    } catch (error) {
      addAlert('❌ Erro de conexão ao salvar configuração', 'error');
    } finally {
      setSavingTelegram(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    loadTelegramConfig();
    loadEmailConfig();

    const savedThresholds = localStorage.getItem(`orbnoc_thresholds_${user.id}`);
    if (savedThresholds) setAlertThresholds(JSON.parse(savedThresholds));
    const savedAlertHistory = localStorage.getItem(`orbnoc_alert_history_${user.id}`);
    if (savedAlertHistory) setAlertHistory(JSON.parse(savedAlertHistory));
    const savedHistory = localStorage.getItem(`orbnoc_history_${user.id}`);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, [user?.id]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
      if (userData) setUser(JSON.parse(userData));
    }
  }, [router]);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        if(data.length > 0 && !selectedDevice) setSelectedDevice(data[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setTimeout(() => setRefreshing(false), 800);
    addAlert('🔄 Sincronização manual concluída!', 'success');
  };

  const pingDevice = async (deviceId) => {
    setPingingDevice(deviceId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/ping`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const threshold = alertThresholds[deviceId];

      if (threshold && data.latency_ms > threshold && data.status === 'online') {
        addAlert(`⚠️ Latência Crítica: ${data.name} atingiu ${data.latency_ms}ms`, 'warning');
      } else if (data.status === 'online') {
        addAlert(`📡 ${data.name}: ${data.latency_ms || 'N/A'}ms`, 'success');
      } else {
        addAlert(`🔴 ${data.name}: Host offline`, 'error');
      }

      setRealtimeLatencyData(prev => {
        const dData = prev[deviceId] || [];
        const newData = [...dData, { timestamp: Date.now(), latency: data.latency_ms }].slice(-50);
        return { ...prev, [deviceId]: newData };
      });

      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, latency: data.latency_ms, status: data.status, last_check: data.timestamp } : d));
      setLastUpdateTime(new Date());
    } catch (error) {
      addAlert('❌ Falha na requisição de ping', 'error');
    } finally {
      setTimeout(() => setPingingDevice(null), 400);
    }
  };

  const exportToCSV = () => {
    const csvData = devices.map(d => ({
      Nome: d.name, IP: d.ip, Localização: d.location || '', Status: d.status,
      Latência: d.latency ? `${d.latency}ms` : '—', Perda: `${d.packet_loss || 0}%`, Jitter: `${Math.round(d.jitter || 0)}ms`
    }));
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispositivos');
    XLSX.writeFile(wb, `orbnoc-inventario.xlsx`);
    addAlert('📊 Planilha Excel exportada!', 'success');
    setShowExportMenu(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDevices();

    let socket = null;
    let heartbeatInterval = null;

    const initSocket = async () => {
      try {
        setReconnecting(true);
        const token = localStorage.getItem('token');
        const io = await import('socket.io-client');
        socket = io.default(WS_BASE_URL, {
          transports: ['websocket', 'polling'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000
        });

        socket.on('connect', () => {
          setConnected(true);
          setReconnecting(false);
          console.log('✅ WebSocket conectado');

          // Heartbeat a cada 25 segundos
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          heartbeatInterval = setInterval(() => {
            if (socket && socket.connected) {
              socket.emit('ping');
            }
          }, 25000);
        });

        socket.on('disconnect', () => {
          setConnected(false);
          setReconnecting(true);
          console.log('❌ WebSocket desconectado, reconectando...');
        });

        socket.on('devices_update', (updatedDevices) => {
          updatedDevices.forEach(device => {
            if (device.latency) {
              setRealtimeLatencyData(prev => {
                const dData = prev[device.id] || [];
                const newData = [...dData, { timestamp: Date.now(), latency: device.latency }].slice(-50);
                return { ...prev, [device.id]: newData };
              });
            }

            const old = devicesRef.current.find(d => d.id === device.id);
            if (old && old.status !== device.status) {
              addAlert(`${device.status === 'offline' ? '🔴 Host Down' : '🟢 Host Up'}: ${device.name}`, device.status === 'offline' ? 'error' : 'success');
            }

            const threshold = alertThresholdsRef.current[device.id];
            if (threshold && device.latency > threshold && device.status === 'online') {
              addAlert(`⚠️ ALERTA SLA: ${device.name} está com ${device.latency}ms (> ${threshold}ms)`, 'warning');
            }
          });

          setDevices(updatedDevices);
          setLastUpdateTime(new Date());
          saveToHistory(updatedDevices);
        });
      } catch (err) {
        console.error('Erro ao conectar WebSocket:', err);
        setReconnecting(false);
      }
    };

    initSocket();
    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (socket) socket.disconnect();
    };
  }, [isAuthenticated]);

  const addDevice = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = { name: formData.get('name'), ip: formData.get('ip'), location: formData.get('location') || '' };
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        e.target.reset();
        setShowForm(false);
        fetchDevices();
        addAlert(`🚀 Host "${payload.name}" adicionado!`, 'success');
      } else {
        addAlert(`❌ Erro ao adicionar host`, 'error');
      }
    } catch (error) { addAlert('❌ Erro ao salvar host', 'error'); }
  };

  const removeDevice = async (id, name) => {
    if (confirm(`Remover definitivamente o host ${name}?`)) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/devices/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { fetchDevices(); addAlert(`🗑️ Host ${name} removido`, 'success'); }
      } catch (error) { addAlert('❌ Erro ao remover host', 'error'); }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'status' ? 'desc' : 'asc');
    }
  };

  const getFilteredAndSortedDevices = () => {
    let filtered = [...devices];

    if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(term) || d.ip.toLowerCase().includes(term) || (d.location && d.location.toLowerCase().includes(term)));
    }

    if (filters.minLatency && filters.minLatency !== '') {
      filtered = filtered.filter(d => d.latency >= parseInt(filters.minLatency));
    }
    if (filters.maxLatency && filters.maxLatency !== '') {
      filtered = filtered.filter(d => d.latency <= parseInt(filters.maxLatency));
    }

    filtered.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
        case 'ip': valA = a.ip; valB = b.ip; break;
        case 'status': valA = a.status === 'online' ? 1 : 0; valB = b.status === 'online' ? 1 : 0; break;
        case 'latency': valA = a.latency || Infinity; valB = b.latency || Infinity; break;
        default: valA = a[sortField]; valB = b[sortField];
      }
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return filtered;
  };

  const getRealtimeChartData = useCallback(() => {
    const onlineDevices = getFilteredAndSortedDevices().filter(d => d.status === 'online').slice(0, 5);
    if (onlineDevices.length === 0) return [];

    const allPoints = [];
    onlineDevices.forEach(device => {
      const history = realtimeLatencyData[device.id] || [];
      history.slice(-20).forEach(point => {
        if (point && point.latency) {
          allPoints.push({
            deviceId: device.id,
            deviceName: device.name,
            time: new Date(point.timestamp).toLocaleTimeString().slice(0, 5),
            latency: point.latency
          });
        }
      });
    });

    const groupedByTime = {};
    allPoints.forEach(point => {
      if (!groupedByTime[point.time]) {
        groupedByTime[point.time] = { time: point.time };
      }
      groupedByTime[point.time][point.deviceName] = point.latency;
    });

    return Object.values(groupedByTime).sort((a, b) => a.time.localeCompare(b.time));
  }, [devices, realtimeLatencyData, getFilteredAndSortedDevices]);

  if (!isAuthenticated || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-lg font-semibold mt-4 text-slate-200">OrbNOC</h2>
        <p className="text-xs text-slate-500 mt-2">Inicializando...</p>
      </div>
    );
  }

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const filteredDevices = getFilteredAndSortedDevices();
  const avgLatency = devices.filter(d => d.status === 'online' && d.latency).length > 0
    ? devices.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + d.latency, 0) / devices.filter(d => d.status === 'online' && d.latency).length
    : 0;
  const chartData = getChartData();
  const unreadAlerts = alertHistory.filter(a => !a.read).length;
  const realtimeChartData = getRealtimeChartData();
  const hasOfflineDevices = offline > 0;
  const availability = devices.length ? Math.round((online / devices.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" ref={dashboardRef}>

      {/* Toast Notification */}
      {showAlert && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg backdrop-blur-xl shadow-xl border ${
            alertMessage.includes('✅') || alertMessage.includes('📡') ? 'bg-emerald-500/10 border-emerald-500/30' :
            alertMessage.includes('❌') || alertMessage.includes('🔴') ? 'bg-rose-500/10 border-rose-500/30' :
            alertMessage.includes('⚠️') ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-blue-500/10 border-blue-500/30'
          }`}>
            <span className="text-sm font-medium">{alertMessage}</span>
          </div>
        </div>
      )}

      {/* WebSocket Reconectando Indicator */}
      {reconnecting && !connected && (
        <div className="fixed bottom-4 left-4 z-50 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-400 animate-pulse">
          🔄 Reconectando WebSocket...
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="border-b border-slate-800 pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6 L12 12 L20 6" strokeLinecap="round"/>
                  <path d="M4 12 L12 18 L20 12" strokeLinecap="round"/>
                </svg>
              </div>
              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">OrbNOC</h1>
              <p className="text-xs text-slate-400">Network Operations Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navigation Buttons */}
            <button
              onClick={() => router.push('/network-map')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Mapa
            </button>

            <button
              onClick={() => router.push('/alerts')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Alertas
            </button>

            <button
              onClick={() => router.push('/reports')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Relatórios
            </button>

            <div className="w-px h-6 bg-slate-700 mx-1" />

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-300">{user?.username}</span>
            </div>

            <button onClick={handleRefresh} disabled={refreshing} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all">
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button onClick={clearAlertHistory} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <div className="relative export-dropdown">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 bg-slate-900 rounded-lg shadow-xl z-50 border border-slate-700 min-w-[160px]">
                  <button onClick={exportToCSV} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors rounded-t-lg">
                    📊 CSV / Excel
                  </button>
                  <button onClick={generatePDF} disabled={isGeneratingPDF} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors rounded-b-lg border-t border-slate-800">
                    📄 {isGeneratingPDF ? 'Gerando...' : 'PDF'}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowTelegramModal(true)}
              className={`px-3 py-2 rounded-lg border transition-all text-sm flex items-center gap-1 ${
                telegramConfig.enabled ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {telegramConfig.enabled ? 'Telegram ON' : 'Telegram OFF'}
            </button>

            <button onClick={handleLogout} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all text-sm text-rose-400">
              Sair
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
            <span className="text-slate-400">{connected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-slate-400">Última atualização: {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className="text-slate-400">Dispositivos: {devices.length}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Total Ativos</p>
                <p className="text-2xl font-semibold mt-1 text-white">{devices.length}</p>
              </div>
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>

          {/* Online */}
          <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 rounded-lg border border-emerald-800/30 hover:border-emerald-500/50 transition-all p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-emerald-400/80 uppercase tracking-wider">Online</p>
                <p className="text-2xl font-semibold mt-1 text-emerald-400">{online}</p>
                <p className="text-[10px] text-emerald-500/60 mt-1">{availability}% do total</p>
              </div>
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Offline */}
          <div className={`bg-gradient-to-br from-rose-900/20 to-rose-900/5 rounded-lg border transition-all p-4 ${hasOfflineDevices ? 'border-rose-500/50 animate-pulse-slow' : 'border-rose-800/30 hover:border-rose-500/30'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-rose-400/80 uppercase tracking-wider">Offline</p>
                <p className={`text-2xl font-semibold mt-1 ${hasOfflineDevices ? 'text-rose-500' : 'text-rose-400'}`}>{offline}</p>
                {hasOfflineDevices && <p className="text-[10px] text-rose-500/60 mt-1 animate-pulse">⚠️ Atenção!</p>}
              </div>
              <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>

          {/* Disponibilidade */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Disponibilidade</p>
                <p className="text-2xl font-semibold mt-1 text-blue-400">{availability}%</p>
                <p className="text-[10px] text-slate-500 mt-1">SLA</p>
                {history.length > 1 && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tendência: {history[0]?.uptime > history[1]?.uptime ? '↑ Melhorando' : history[0]?.uptime < history[1]?.uptime ? '↓ Piorando' : '→ Estável'}
                  </p>
                )}
              </div>
              <div className="w-12 h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.slice(0, 20).reverse()}>
                    <Area type="monotone" dataKey="uptime" stroke="#3b82f6" strokeWidth={1} fill="url(#uptimeGradient)" />
                    <defs>
                      <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Latência */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Latência Média</p>
                <p className="text-2xl font-semibold mt-1 text-amber-400">{avgLatency ? `${Math.round(avgLatency)}ms` : '—'}</p>
                {latencyTrend.value > 0 && latencyTrend.direction !== 'stable' && (
                  <div className={`flex items-center gap-1 mt-1 text-[10px] ${latencyTrend.direction === 'down' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {latencyTrend.direction === 'down' ? '↓' : '↑'} {latencyTrend.value}ms ({latencyTrend.percentage}%)
                  </div>
                )}
              </div>
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search e Filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar host, IP ou localização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setStatusFilter('all')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Todos</button>
              <button onClick={() => setStatusFilter('online')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Online</button>
              <button onClick={() => setStatusFilter('offline')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'offline' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Offline</button>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${showAdvancedFilters ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'}`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Latência Mínima (ms)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minLatency}
                  onChange={(e) => setFilters(prev => ({ ...prev, minLatency: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Latência Máxima (ms)</label>
                <input
                  type="number"
                  placeholder="100"
                  value={filters.maxLatency}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxLatency: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ minLatency: '', maxLatency: '', minUptime: '', tags: [] })}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Device Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                Dispositivos
                <span className="text-xs text-slate-500 font-normal">({filteredDevices.length})</span>
              </h2>
              <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar
              </button>
            </div>

            {showForm && (
              <form onSubmit={addDevice} className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-4 rounded-lg border border-blue-500/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input name="name" placeholder="Nome do equipamento" required className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200" />
                  <input name="ip" placeholder="Endereço IP" required className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200" />
                  <div className="flex gap-2">
                    <input name="location" placeholder="Localização" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200" />
                    <button type="submit" className="px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">Salvar</button>
                  </div>
                </div>
              </form>
            )}

            <div className="bg-slate-900/30 rounded-lg border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('status')}>Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('name')}>Dispositivo {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('ip')}>IP {sortField === 'ip' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleSort('latency')}>Latência {sortField === 'latency' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-12 text-center text-slate-500">Nenhum dispositivo encontrado</td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <Fragment key={device.id}>
                          <tr onClick={() => setExpandedDevice(expandedDevice === device.id ? null : device.id)} className={`cursor-pointer transition-colors hover:bg-slate-800/30 ${expandedDevice === device.id ? 'bg-slate-800/20' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                <span className={`text-xs font-medium ${device.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {device.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-200">{device.name}</div>
                              {device.location && <div className="text-[10px] text-slate-500">{device.location}</div>}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{device.ip}</td>
                            <td className="px-4 py-3">
                              {device.latency && device.status === 'online' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-slate-700 rounded-full h-1">
                                    <div className={`h-1 rounded-full ${device.latency < 40 ? 'bg-emerald-500' : device.latency < 100 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, device.latency / 10)}%` }}></div>
                                  </div>
                                  <span className={`text-xs font-mono ${device.latency < 40 ? 'text-emerald-400' : device.latency < 100 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {device.latency}ms
                                  </span>
                                </div>
                              ) : <span className="text-slate-500 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); pingDevice(device.id); }} disabled={pingingDevice === device.id} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                  Ping
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); removeDevice(device.id, device.name); }} className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Remover
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedDevice === device.id && (
                            <tr className="bg-slate-900/40">
                              <td colSpan="5" className="px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <p className="text-slate-500">Localização</p>
                                    <p className="text-slate-300">{device.location || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500">Último check</p>
                                    <p className="text-slate-300">{device.last_check ? new Date(device.last_check).toLocaleString() : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500">Alerta SLA</p>
                                    {alertThresholds[device.id] ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-amber-400">Limite: {alertThresholds[device.id]}ms</span>
                                        <button onClick={() => removeAlertConfig(device.id)} className="text-rose-400 text-xs">Remover</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setSelectedAlertDevice(device); setShowAlertConfig(true); }} className="text-blue-400 hover:text-blue-300 text-xs">Configurar alerta</button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right - Analytics */}
          <div className="space-y-6">
            {/* Real-time Latency Chart */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                  Latência em Tempo Real
                </h3>
                <button onClick={() => { const onlineDevices = getFilteredAndSortedDevices().filter(d => d.status === 'online'); onlineDevices.forEach(d => pingDevice(d.id)); addAlert(`📡 Testando ${onlineDevices.length} dispositivos...`, 'success'); }} className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-xs transition-all">
                  Testar Todos
                </button>
              </div>
              {getFilteredAndSortedDevices().filter(d => d.status === 'online').length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={realtimeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                        formatter={(value, name) => [`${value}ms`, name]}
                        itemStyle={{ color: '#e2e8f0', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} verticalAlign="bottom" height={30} />
                      {getFilteredAndSortedDevices().filter(d => d.status === 'online').slice(0, 5).map((device, idx) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
                        return <Line key={device.id} type="monotone" dataKey={device.name} stroke={colors[idx % colors.length]} strokeWidth={1.5} dot={false} name={device.name} isAnimationActive={false} />;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Nenhum dispositivo online</div>
              )}
            </div>

            {/* Uptime History */}
            {history.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
                  Disponibilidade (Últimas 24h)
                </h3>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-400">{history[0]?.uptime || 100}%</p>
                    <p className="text-xs text-slate-500 mt-1">SLA Atual</p>
                  </div>
                  <div className="w-32">
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={history.slice(0, 24).reverse()}>
                        <Line type="monotone" dataKey="uptime" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Status Pie */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
                Distribuição
              </h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData.statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
                      <Cell fill="#10b981" /><Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} verticalAlign="bottom" height={30} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alert History */}
            {alertHistory.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-lg border border-slate-800 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span className="w-1 h-5 bg-rose-500 rounded-full"></span>
                    Alertas Recentes
                    {unreadAlerts > 0 && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full animate-pulse">{unreadAlerts}</span>}
                  </h3>
                  <button onClick={clearAlertHistory} className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors">
                    Limpar
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alertHistory.slice(0, 10).map(alert => (
                    <div key={alert.id} className={`p-2 rounded border transition-all ${alert.type === 'error' ? 'bg-rose-500/10 border-rose-500/20' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <p className="text-xs">{alert.message}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{alert.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-800 pt-4 mt-4">
          <div className="flex flex-wrap justify-between text-xs">
            <div className="flex gap-4 text-slate-500">
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Polling: 30s</span>
              <span className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>WebSocket: {connected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <div className="text-slate-500">OrbNOC Network Operations Center © 2026</div>
          </div>
        </footer>
      </div>

      {/* Alert Config Modal */}
      {showAlertConfig && selectedAlertDevice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Configurar Alerta SLA</h3>
            <p className="text-sm text-slate-400 mb-4">{selectedAlertDevice.name}</p>
            <div className="space-y-2 mb-6">
              <label className="text-xs text-slate-400 uppercase tracking-wider">Limite de Latência (ms)</label>
              <input type="number" id="modal-threshold" min="10" max="1000" defaultValue={alertThresholds[selectedAlertDevice.id] || 120} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAlertConfig(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={() => { const threshold = parseInt(document.getElementById('modal-threshold').value); if (threshold) configureAlert(selectedAlertDevice.id, threshold); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Config Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Configurar Telegram</h3>
            <p className="text-sm text-slate-400 mb-4">Receba alertas no Telegram</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 block mb-1 uppercase tracking-wider">Bot Token</label>
                <input type="text" id="config-bot-token" defaultValue={telegramConfig.botToken} placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 text-slate-200" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1 uppercase tracking-wider">Chat ID</label>
                <input type="text" id="config-chat-id" defaultValue={telegramConfig.chatId} placeholder="-1001234567890" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 text-slate-200" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowTelegramModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={() => { const botToken = document.getElementById('config-bot-token').value.trim(); const chatId = document.getElementById('config-chat-id').value.trim(); saveTelegramConfig(!!(botToken && chatId), botToken, chatId); setShowTelegramModal(false); }} disabled={savingTelegram} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}