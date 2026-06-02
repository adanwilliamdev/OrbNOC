'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React, { useEffect, useState, useRef, Fragment, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const API_BASE_URL = 'https://orbnoc-backend-nmlq.onrender.com';
const WS_BASE_URL = 'wss://orbnoc-backend-nmlq.onrender.com';

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
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [alertThresholds, setAlertThresholds] = useState({});
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [selectedAlertDevice, setSelectedAlertDevice] = useState(null);
  const [portConfigs, setPortConfigs] = useState({});
  const [realtimeLatencyData, setRealtimeLatencyData] = useState({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  const [emailConfig, setEmailConfig] = useState({ enabled: false, email: '' });
  const [telegramConfig, setTelegramConfig] = useState({ enabled: false, botToken: '', chatId: '' });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const alertThresholdsRef = useRef(alertThresholds);
  const portConfigsRef = useRef(portConfigs);
  const devicesRef = useRef(devices);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showExportMenu && !e.target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

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
    addAlert(`Alerta configurado: limite de ${threshold}ms`, 'success');
    setShowAlertConfig(false);
    setSelectedAlertDevice(null);
  };

  const removeAlertConfig = (deviceId) => {
    const newThresholds = { ...alertThresholds };
    delete newThresholds[deviceId];
    setAlertThresholds(newThresholds);
    localStorage.setItem(`orbnoc_thresholds_${user?.id}`, JSON.stringify(newThresholds));
    addAlert(`Alerta removido`, 'success');
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
      { name: 'Online', value: devices.filter(d => d.status === 'online').length, color: '#3b82f6' },
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
      addAlert('Relatório PDF exportado!', 'success');
    } catch (error) {
      addAlert('Erro ao gerar PDF', 'error');
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
        addAlert(enabled ? 'Telegram configurado com sucesso!' : 'Telegram desativado', enabled ? 'success' : 'warning');
      } else {
        addAlert(`Erro ao salvar configuração`, 'error');
      }
    } catch (error) {
      addAlert('Erro de conexão ao salvar configuração', 'error');
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
        addAlert(enabled ? `Email configurado: ${email}` : 'Email desativado', 'success');
      } else {
        addAlert('Erro ao salvar configuração de email', 'error');
      }
    } catch (error) {
      addAlert('Erro de conexão', 'error');
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
    addAlert('Sincronização manual concluída!', 'success');
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
        addAlert(`Latência Crítica: ${data.name} atingiu ${data.latency_ms}ms`, 'warning');
      } else if (data.status === 'online') {
        addAlert(`${data.name}: ${data.latency_ms || 'N/A'}ms`, 'success');
      } else {
        addAlert(`${data.name}: Host offline`, 'error');
      }

      setRealtimeLatencyData(prev => {
        const dData = prev[deviceId] || [];
        const newData = [...dData, { timestamp: Date.now(), latency: data.latency_ms }].slice(-50);
        return { ...prev, [deviceId]: newData };
      });

      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, latency: data.latency_ms, status: data.status, last_check: data.timestamp } : d));
      setLastUpdateTime(new Date());
    } catch (error) {
      addAlert('Falha na requisição de ping', 'error');
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
    addAlert('Planilha Excel exportada!', 'success');
    setShowExportMenu(false);
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

        socket.on('connect', () => {
          setConnected(true);
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
              addAlert(`${device.status === 'offline' ? 'Host Down' : 'Host Up'}: ${device.name}`, device.status === 'offline' ? 'error' : 'success');
            }

            const threshold = alertThresholdsRef.current[device.id];
            if (threshold && device.latency > threshold && device.status === 'online') {
              addAlert(`ALERTA SLA: ${device.name} está com ${device.latency}ms (> ${threshold}ms)`, 'warning');
            }
          });

          setDevices(updatedDevices);
          setLastUpdateTime(new Date());
          saveToHistory(updatedDevices);
        });

        socket.on('disconnect', () => {
          setConnected(false);
        });
      } catch (err) {
        console.error('Erro ao conectar WebSocket:', err);
      }
    };

    initSocket();
    return () => {
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
        addAlert(`Host "${payload.name}" adicionado!`, 'success');
      }
    } catch (error) { addAlert('Erro ao salvar host', 'error'); }
  };

  const removeDevice = async (id, name) => {
    if (confirm(`Remover definitivamente o host ${name}?`)) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/devices/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { fetchDevices(); addAlert(`Host ${name} removido`, 'success'); }
      } catch (error) { addAlert('Erro ao remover host', 'error'); }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" ref={dashboardRef}>

      {/* Toast Notification */}
      {showAlert && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg backdrop-blur-xl shadow-xl border ${
            alertMessage.includes('✅') ? 'bg-emerald-500/10 border-emerald-500/30' :
            alertMessage.includes('❌') ? 'bg-rose-500/10 border-rose-500/30' :
            alertMessage.includes('⚠️') ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-blue-500/10 border-blue-500/30'
          }`}>
            <span className="text-sm font-medium">{alertMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="border-b border-slate-800 pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6 L12 12 L20 6" strokeLinecap="round"/>
                  <path d="M4 12 L12 18 L20 12" strokeLinecap="round"/>
                  <path d="M4 18 L12 24 L20 18" strokeLinecap="round"/>
                </svg>
              </div>
              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">OrbNOC</h1>
              <p className="text-xs text-slate-500">Network Operations Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">{user?.username}</span>
            </div>

            <button onClick={handleRefresh} disabled={refreshing} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors">
              <span className="text-sm">{refreshing ? '⏳' : '🔄'}</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors text-sm"
              >
                Exportar ▼
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 bg-slate-900 rounded-lg shadow-xl z-50 border border-slate-800 min-w-[160px]">
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
              className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                telegramConfig.enabled ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {telegramConfig.enabled ? 'Telegram ON' : 'Telegram OFF'}
            </button>

            <button onClick={handleLogout} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors text-sm text-rose-400">
              Sair
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <span>{connected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Última atualização: {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Dispositivos: {devices.length}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-semibold mt-1 text-blue-400">{devices.length}</p>
          </div>

          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Online</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-400">{online}</p>
          </div>

          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Offline</p>
            <p className="text-2xl font-semibold mt-1 text-rose-400">{offline}</p>
          </div>

          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Disponibilidade</p>
            <p className="text-2xl font-semibold mt-1 text-blue-400">{devices.length ? Math.round((online/devices.length)*100) : 0}%</p>
          </div>

          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Latência Média</p>
            <p className="text-2xl font-semibold mt-1 text-amber-400">{avgLatency ? `${Math.round(avgLatency)}ms` : '—'}</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar host, IP ou localização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setStatusFilter('all')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>Todos</button>
            <button onClick={() => setStatusFilter('online')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              statusFilter === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>Online</button>
            <button onClick={() => setStatusFilter('offline')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              statusFilter === 'offline' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>Offline</button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Device Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-300">Dispositivos</h2>
              <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
                + Adicionar
              </button>
            </div>

            {showForm && (
              <form onSubmit={addDevice} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input name="name" placeholder="Nome" required className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <input name="ip" placeholder="IP" required className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <input name="location" placeholder="Localização" className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('status')}>Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('name')}>Dispositivo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('ip')}>IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300" onClick={() => handleSort('latency')}>Latência</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-12 text-center text-slate-500">
                          Nenhum dispositivo encontrado
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <Fragment key={device.id}>
                          <tr
                            onClick={() => setExpandedDevice(expandedDevice === device.id ? null : device.id)}
                            className={`cursor-pointer transition-colors hover:bg-slate-800/30 ${expandedDevice === device.id ? 'bg-slate-800/20' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                <span className={`text-xs font-medium ${device.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {device.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{device.name}</div>
                              {device.location && <div className="text-[10px] text-slate-500">{device.location}</div>}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{device.ip}</td>
                            <td className="px-4 py-3">
                              {device.latency && device.status === 'online' ? (
                                <span className={`font-mono text-xs ${device.latency < 40 ? 'text-emerald-400' : device.latency < 100 ? 'text-amber-400' : 'text-rose-400'}`}>
                                  {device.latency}ms
                                </span>
                              ) : <span className="text-slate-500 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); pingDevice(device.id); }}
                                  disabled={pingingDevice === device.id}
                                  className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-xs transition-colors"
                                >
                                  {pingingDevice === device.id ? '...' : 'Ping'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeDevice(device.id, device.name); }}
                                  className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded text-xs transition-colors"
                                >
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
                                        <button onClick={() => removeAlertConfig(device.id)} className="text-rose-400">Remover</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setSelectedAlertDevice(device); setShowAlertConfig(true); }} className="text-blue-400 hover:text-blue-300">
                                        Configurar alerta
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

          {/* Right - Analytics */}
          <div className="space-y-6">
            {/* Real-time Latency Chart */}
            <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-300">Latência em Tempo Real</h3>
                <button
                  onClick={() => {
                    const onlineDevices = getFilteredAndSortedDevices().filter(d => d.status === 'online');
                    onlineDevices.forEach(d => pingDevice(d.id));
                  }}
                  className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-xs transition-colors"
                >
                  Testar Todos
                </button>
              </div>

              {getFilteredAndSortedDevices().filter(d => d.status === 'online').length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={realtimeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} label={{ value: 'ms', angle: -90, position: 'insideLeft', style: { fill: '#475569', fontSize: 10 } }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} verticalAlign="bottom" height={30} />
                      {getFilteredAndSortedDevices()
                        .filter(d => d.status === 'online')
                        .slice(0, 5)
                        .map((device, idx) => {
                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
                          return (
                            <Line key={device.id} type="monotone" dataKey={device.name} stroke={colors[idx % colors.length]} strokeWidth={1.5} dot={false} name={device.name} isAnimationActive={false} />
                          );
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-500 text-sm">
                  Nenhum dispositivo online
                </div>
              )}
            </div>

            {/* Uptime History */}
            {history.length > 0 && (
              <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Disponibilidade</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.timelineData.slice(-10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
                      <Line type="monotone" dataKey="uptime" stroke="#3b82f6" strokeWidth={1.5} name="Uptime %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Status Pie Chart */}
            <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Distribuição</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData.statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} verticalAlign="bottom" height={30} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alert History */}
            {alertHistory.length > 0 && (
              <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  Alertas Recentes
                  {unreadAlerts > 0 && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">{unreadAlerts}</span>}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alertHistory.slice(0, 10).map(alert => (
                    <div key={alert.id} className={`p-2 rounded border ${
                      alert.type === 'error' ? 'bg-rose-500/10 border-rose-500/20' :
                      alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                      'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
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
          <div className="flex flex-wrap justify-between text-xs text-slate-500">
            <div className="flex gap-4">
              <span>Polling: 10s</span>
              <span>WebSocket: {connected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <div>
              <span>OrbNOC • © 2026</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Alert Config Modal */}
      {showAlertConfig && selectedAlertDevice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Configurar Alerta SLA</h3>
            <p className="text-sm text-slate-400 mb-4">{selectedAlertDevice.name}</p>
            <div className="space-y-2 mb-6">
              <label className="text-xs text-slate-400">Limite de Latência (ms)</label>
              <input
                type="number"
                id="modal-threshold"
                min="10"
                max="1000"
                defaultValue={alertThresholds[selectedAlertDevice.id] || 120}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAlertConfig(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Cancelar</button>
              <button onClick={() => { const threshold = parseInt(document.getElementById('modal-threshold').value); if (threshold) configureAlert(selectedAlertDevice.id, threshold); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Config Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Configurar Telegram</h3>
            <p className="text-sm text-slate-400 mb-4">Receba alertas no Telegram</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Bot Token</label>
                <input type="text" id="config-bot-token" defaultValue={telegramConfig.botToken} placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Chat ID</label>
                <input type="text" id="config-chat-id" defaultValue={telegramConfig.chatId} placeholder="-1001234567890" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowTelegramModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Cancelar</button>
              <button onClick={() => { const botToken = document.getElementById('config-bot-token').value.trim(); const chatId = document.getElementById('config-chat-id').value.trim(); saveTelegramConfig(!!(botToken && chatId), botToken, chatId); setShowTelegramModal(false); }} disabled={savingTelegram} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
