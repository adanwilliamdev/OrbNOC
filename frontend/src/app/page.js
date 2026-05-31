'use client';

import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function Home() {
  const router = useRouter();
  const dashboardRef = useRef(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
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
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [alertThresholds, setAlertThresholds] = useState({});
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [selectedAlertDevice, setSelectedAlertDevice] = useState(null);
  const [portConfigs, setPortConfigs] = useState({});
  const [realtimeLatencyData, setRealtimeLatencyData] = useState({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState(null);

  const [widgetLayout, setWidgetLayout] = useState({
    showStats: true,
    showFilters: true,
    showLatencyChart: true,
    showAlertHistory: true,
    showCharts: true,
    showPorts: false,
    showEmailConfig: false,
    showTelegramConfig: false
  });

  const [emailConfig, setEmailConfig] = useState({ enabled: false, email: '' });
  const [telegramConfig, setTelegramConfig] = useState({ enabled: false, botToken: '', chatId: '' });
  const [savingTelegram, setSavingTelegram] = useState(false);

  const alertThresholdsRef = useRef(alertThresholds);
  const portConfigsRef = useRef(portConfigs);
  const devicesRef = useRef(devices);

  useEffect(() => { alertThresholdsRef.current = alertThresholds; }, [alertThresholds]);
  useEffect(() => { portConfigsRef.current = portConfigs; }, [portConfigs]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

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

  const configurePort = (deviceId, port) => {
    const newPortConfigs = { ...portConfigs, [deviceId]: { port, enabled: true } };
    setPortConfigs(newPortConfigs);
    localStorage.setItem(`orbnoc_ports_${user?.id}`, JSON.stringify(newPortConfigs));
    addAlert(`🔌 Monitoramento da porta ${port} ativado`, 'success');
  };

  const removePortConfig = (deviceId) => {
    const newPortConfigs = { ...portConfigs };
    delete newPortConfigs[deviceId];
    setPortConfigs(newPortConfigs);
    localStorage.setItem(`orbnoc_ports_${user?.id}`, JSON.stringify(newPortConfigs));
    addAlert(`🔕 Monitoramento de porta removido`, 'success');
  };

  const generatePDF = async () => {
    if (typeof window === 'undefined') return;
    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const element = dashboardRef.current;
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0f0f12', logging: false, useCORS: true });
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

  const saveEmailConfig = async (enabled, email) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/alerts/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled, email })
      });

      if (response.ok) {
        setEmailConfig({ enabled, email });
        addAlert(enabled ? `📧 Email configurado: ${email}` : '📧 Email desativado', 'success');
      } else {
        addAlert('❌ Erro ao salvar configuração de email', 'error');
      }
    } catch (error) {
      addAlert('❌ Erro de conexão', 'error');
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
    const savedPortConfigs = localStorage.getItem(`orbnoc_ports_${user.id}`);
    if (savedPortConfigs) setPortConfigs(JSON.parse(savedPortConfigs));
    const savedWidgetLayout = localStorage.getItem(`orbnoc_widgets_${user.id}`);
    if (savedWidgetLayout) setWidgetLayout(prev => ({ ...prev, ...JSON.parse(savedWidgetLayout) }));
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
      } else {
        addAlert(`📡 ${data.name}: ${data.latency_ms || 'N/A'}ms [${data.status.toUpperCase()}]`, data.status === 'online' ? 'success' : 'error');
      }

      setRealtimeLatencyData(prev => {
        const dData = prev[deviceId] || [];
        return { ...prev, [deviceId]: [...dData, { timestamp: Date.now(), latency: data.latency_ms }].slice(-50) };
      });

      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, latency: data.latency_ms, status: data.status, last_check: data.timestamp } : d));
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
  };

  const toggleWidget = (widgetName) => {
    setWidgetLayout(prev => {
      const nLayout = { ...prev, [widgetName]: !prev[widgetName] };
      localStorage.setItem(`orbnoc_widgets_${user?.id}`, JSON.stringify(nLayout));
      return nLayout;
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDevices();

    let socket = null;
    const initSocket = async () => {
      try {
        const token = localStorage.getItem('token');
        const io = await import('socket.io-client');
        socket = io.default(WS_BASE_URL, {
          transports: ['websocket', 'polling'],
          auth: { token }
        });
        socket.on('connect', () => setConnected(true));
        socket.on('devices_update', (updatedDevices) => {
          updatedDevices.forEach(device => {
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
          saveToHistory(updatedDevices);
        });
        socket.on('disconnect', () => setConnected(false));
      } catch (err) { console.error(err); }
    };
    initSocket();
    return () => { if (socket) socket.disconnect(); };
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
    if (statusFilter !== 'todos') filtered = filtered.filter(d => d.status === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(term) || d.ip.toLowerCase().includes(term) || (d.location && d.location.toLowerCase().includes(term)));
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

  if (!isAuthenticated || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <h2 className="text-lg font-semibold mt-6 text-slate-200">OrbNOC Core</h2>
        <p className="text-xs text-slate-500 mt-2">Inicializando sistema de monitoramento...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200" ref={dashboardRef}>

      {/* Toast Notification */}
      {showAlert && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl backdrop-blur-xl shadow-2xl border ${
            alertMessage.includes('✅') ? 'bg-emerald-500/10 border-emerald-500/30' :
            alertMessage.includes('❌') ? 'bg-rose-500/10 border-rose-500/30' :
            alertMessage.includes('⚠️') ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-indigo-500/10 border-indigo-500/30'
          }`}>
            <span className="text-sm font-medium text-slate-200">{alertMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* Header Premium */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-slate-900/80 backdrop-blur-sm border border-slate-800/50">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>

          <div className="relative p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                {/* Ícone de Rede Animado - Estilo ╱╲╱╲╱╲ */}
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Padrão ╱╲╱╲╱╲ - Linhas diagonais animadas */}
                        <g>
                          {/* Linha 1 */}
                          <line x1="4" y1="6" x2="10" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-1"/>
                          {/* Linha 2 */}
                          <line x1="10" y1="12" x2="4" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-2"/>
                          {/* Linha 3 */}
                          <line x1="12" y1="8" x2="18" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-3"/>
                          {/* Linha 4 */}
                          <line x1="18" y1="14" x2="12" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-line-4"/>
                          {/* Linha 5 - adicional para o padrão */}
                          <line x1="8" y1="4" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" className="animate-line-5"/>
                          {/* Linha 6 */}
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
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">OrbNOC Systems</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Network Operations Center • Real-time Infrastructure Monitoring</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">👤</span>
                  </div>
                  <span className="text-sm font-medium text-slate-300">{user?.username}</span>
                </div>

                <button onClick={handleRefresh} disabled={refreshing} className="group relative px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-all duration-200">
                  <span className="text-sm">{refreshing ? '⏳' : '🔄'}</span>
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Atualizar
                  </span>
                </button>

                <div className="relative group">
                  <button className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-all duration-200">
                    <span className="text-sm">📊 Exportar ▼</span>
                  </button>
                  <div className="absolute right-0 mt-2 w-40 bg-slate-800 rounded-xl shadow-xl overflow-hidden z-10 hidden group-hover:block border border-slate-700/50">
                    <button onClick={exportToCSV} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors">📥 Exportar CSV</button>
                    <button onClick={generatePDF} disabled={isGeneratingPDF} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors">📄 Exportar PDF</button>
                  </div>
                </div>

                <button onClick={() => toggleWidget('showTelegramConfig')} className={`px-4 py-2 rounded-xl border transition-all duration-200 ${
                  telegramConfig.enabled ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
                }`}>
                  {telegramConfig.enabled ? '📱 Telegram ON' : '📱 Telegram OFF'}
                </button>

                <button onClick={handleLogout} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all duration-200">
                  🚪 Sair
                </button>
              </div>
            </div>

            {/* Status Bar */}
            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                <span className="text-xs text-slate-400">{connected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">🕒 Última atualização: {new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">📡 Dispositivos monitorados: {devices.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Premium */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 hover:border-indigo-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
            <div className="relative p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ativos</p>
              <p className="text-3xl font-bold mt-2 text-indigo-400">{devices.length}</p>
              <div className="mt-2 text-[10px] text-slate-600">Infraestrutura monitorada</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 border border-emerald-800/30 hover:border-emerald-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl"></div>
            <div className="relative p-5">
              <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">Online</p>
              <p className="text-3xl font-bold mt-2 text-emerald-400">{online}</p>
              <div className="mt-2 text-[10px] text-emerald-500/60">Hosts operacionais</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-900/20 to-rose-900/5 border border-rose-800/30 hover:border-rose-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl"></div>
            <div className="relative p-5">
              <p className="text-xs font-semibold text-rose-400/80 uppercase tracking-wider">Offline</p>
              <p className="text-3xl font-bold mt-2 text-rose-400">{offline}</p>
              <div className="mt-2 text-[10px] text-rose-500/60">Hosts inativos</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900/20 to-blue-900/5 border border-blue-800/30 hover:border-blue-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl"></div>
            <div className="relative p-5">
              <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-wider">Disponibilidade</p>
              <p className="text-3xl font-bold mt-2 text-blue-400">{devices.length ? Math.round((online/devices.length)*100) : 0}%</p>
              <div className="mt-2 text-[10px] text-blue-500/60">SLA geral da rede</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-900/20 to-amber-900/5 border border-amber-800/30 hover:border-amber-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl"></div>
            <div className="relative p-5">
              <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider">Latência Média</p>
              <p className="text-3xl font-bold mt-2 text-amber-400">{avgLatency ? `${Math.round(avgLatency)}ms` : '—'}</p>
              <div className="mt-2 text-[10px] text-amber-500/60">Tempo de resposta</div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50 backdrop-blur-sm">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="🔍 Buscar host, IP ou localização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div className="flex gap-2 bg-slate-800/30 p-1 rounded-xl border border-slate-700/40">
            <button onClick={() => setStatusFilter('todos')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              statusFilter === 'todos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}>Todos</button>
            <button onClick={() => setStatusFilter('online')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              statusFilter === 'online' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}>Online</button>
            <button onClick={() => setStatusFilter('offline')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              statusFilter === 'offline' ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}>Offline</button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Device Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Add Device Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                Inventário de Dispositivos
              </h2>
              <button onClick={() => setShowForm(!showForm)} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/20">
                {showForm ? '✕ Cancelar' : '＋ Novo Host'}
              </button>
            </div>

            {/* Add Device Form */}
            {showForm && (
              <form onSubmit={addDevice} className="bg-slate-900/60 backdrop-blur-sm p-5 rounded-xl border border-indigo-500/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input name="name" placeholder="Nome do equipamento" required className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder:text-slate-500" />
                  <input name="ip" placeholder="Endereço IP" required className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder:text-slate-500" />
                  <div className="flex gap-2">
                    <input name="location" placeholder="Localização" className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder:text-slate-500" />
                    <button type="submit" className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-all">Salvar</button>
                  </div>
                </div>
              </form>
            )}

            {/* Devices Table */}
            <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('status')}>Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('name')}>Dispositivo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('ip')}>IP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('latency')}>Latência</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Métricas</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-4xl">📡</span>
                            <p>Nenhum dispositivo encontrado</p>
                            <button onClick={() => setShowForm(true)} className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Clique aqui para adicionar</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <Fragment key={device.id}>
                          <tr
                            onClick={() => setExpandedDevice(expandedDevice === device.id ? null : device.id)}
                            className={`cursor-pointer transition-all duration-200 hover:bg-slate-800/30 ${expandedDevice === device.id ? 'bg-slate-800/40' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                <span className={`text-xs font-medium ${device.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {device.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-200">{device.name}</div>
                              {device.location && <div className="text-[10px] text-slate-500 mt-0.5">📍 {device.location}</div>}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{device.ip}</td>
                            <td className="px-4 py-3">
                              {device.latency && device.status === 'online' ? (
                                <div className="flex items-center gap-1">
                                  <span className={`font-bold ${device.latency < 40 ? 'text-emerald-400' : device.latency < 100 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    ⚡ {device.latency}ms
                                  </span>
                                </div>
                              ) : <span className="text-slate-500 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {device.avg_latency && device.status === 'online' ? (
                                <div className="text-xs text-slate-400">
                                  <div>Média: <span className="text-slate-300">{Math.round(device.avg_latency)}ms</span></div>
                                  <div className="text-[10px]">Jitter: {Math.round(device.jitter || 0)}ms</div>
                                </div>
                              ) : <span className="text-slate-500 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); pingDevice(device.id); }}
                                  disabled={pingingDevice === device.id}
                                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-xs font-medium transition-all"
                                >
                                  {pingingDevice === device.id ? '⏳' : '📡'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeDevice(device.id, device.name); }}
                                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-xs font-medium transition-all"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedDevice === device.id && (
                            <tr className="bg-slate-800/20">
                              <td colSpan="6" className="px-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Informações Detalhadas</p>
                                    <p className="text-sm text-slate-300">📍 Localização: {device.location || 'Não definida'}</p>
                                    <p className="text-sm text-slate-300">🕒 Último check: {device.last_check ? new Date(device.last_check).toLocaleString() : 'N/A'}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Métricas de Qualidade</p>
                                    <p className="text-sm text-slate-300">📊 Perda de pacotes: {device.packet_loss || 0}%</p>
                                    <p className="text-sm text-slate-300">⚡ Jitter: {Math.round(device.jitter || 0)}ms</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500">Configurações de Alerta</p>
                                    {alertThresholds[device.id] ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-amber-400">⚠️ Limite: {alertThresholds[device.id]}ms</span>
                                        <button onClick={() => removeAlertConfig(device.id)} className="text-xs text-rose-400">Remover</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setSelectedAlertDevice(device); setShowAlertConfig(true); }} className="text-sm text-indigo-400 hover:text-indigo-300">
                                        Definir limite de alerta
                                      </button>
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

          {/* Right Column - Analytics & Alerts */}
          <div className="space-y-6">
            {/* Latency Chart */}
            <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-5 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                Monitor de Latência em Tempo Real
              </h3>
              {selectedDevice ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={(realtimeLatencyData[selectedDevice.id] || []).map(d => ({ time: new Date(d.timestamp).toLocaleTimeString(), latency: d.latency }))}>
                      <defs>
                        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                      <Area type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} fill="url(#latencyGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                  Selecione um dispositivo na tabela
                </div>
              )}
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>📡 Dispositivo: {selectedDevice?.name || '—'}</span>
                <span>🔄 Atualização em tempo real</span>
              </div>
            </div>

            {/* Uptime History Chart */}
            {history.length > 0 && (
              <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></span>
                  Histórico de Disponibilidade
                </h3>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.timelineData.slice(-10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                      <Line type="monotone" dataKey="uptime" stroke="#10b981" strokeWidth={2} name="Uptime %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Status Pie Chart */}
            <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-5 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-rose-500 to-orange-500 rounded-full"></span>
                Distribuição de Status
              </h3>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData.statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alert History */}
            {widgetLayout.showAlertHistory && alertHistory.length > 0 && (
              <div className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></span>
                  Últimos Alertas
                  {unreadAlerts > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">{unreadAlerts} novos</span>
                  )}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alertHistory.slice(0, 10).map(alert => (
                    <div key={alert.id} className={`p-3 rounded-lg border ${
                      alert.type === 'error' ? 'bg-rose-500/10 border-rose-500/20' :
                      alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                      'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-1">{alert.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-slate-900/40 rounded-xl border border-slate-800/50 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-500">
            <div className="flex gap-4">
              <span>🔴 Pooling: 10s</span>
              <span>🔵 WebSocket: {connected ? 'Conectado' : 'Desconectado'}</span>
              <span>🤖 Telegram: {telegramConfig.enabled ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="flex gap-4">
              <span>OrbNOC | Network Monitoring & Operations • © 2026 Adan W. O. Santos</span>
              <span>Versão 2.0.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Alert Config Modal */}
      {showAlertConfig && selectedAlertDevice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-200 mb-2">Configurar Alerta SLA</h3>
            <p className="text-sm text-slate-400 mb-4">Dispositivo: <span className="text-indigo-400 font-medium">{selectedAlertDevice.name}</span></p>
            <div className="space-y-2 mb-6">
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Limite de Latência (ms)</label>
              <input
                type="number"
                id="modal-threshold"
                min="10"
                max="1000"
                defaultValue={alertThresholds[selectedAlertDevice.id] || 120}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
              />
              <p className="text-[10px] text-slate-500">Alertas serão disparados quando a latência exceder este valor</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAlertConfig(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-all">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const threshold = parseInt(document.getElementById('modal-threshold').value);
                  if (threshold) configureAlert(selectedAlertDevice.id, threshold);
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Config Modal */}
      {widgetLayout.showTelegramConfig && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-200 mb-2">Configurar Telegram</h3>
            <p className="text-sm text-slate-400 mb-4">Receba alertas diretamente no Telegram</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Bot Token</label>
                <input
                  type="text"
                  id="config-bot-token"
                  defaultValue={telegramConfig.botToken || ''}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Chat ID</label>
                <input
                  type="text"
                  id="config-chat-id"
                  defaultValue={telegramConfig.chatId || ''}
                  placeholder="-1001234567890"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 text-slate-200"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => toggleWidget('showTelegramConfig')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-all">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const botToken = document.getElementById('config-bot-token').value.trim();
                  const chatId = document.getElementById('config-chat-id').value.trim();
                  const enabled = !!(botToken && chatId);
                  saveTelegramConfig(enabled, botToken, chatId);
                  toggleWidget('showTelegramConfig');
                }}
                disabled={savingTelegram}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
              >
                {savingTelegram ? 'Salvando...' : 'Salvar e Testar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}