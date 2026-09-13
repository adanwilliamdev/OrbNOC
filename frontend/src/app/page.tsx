// page.tsx - com melhorias de contraste, alinhamento e espaçamento
// Convertido para TypeScript e decomposto em componentes por responsabilidade.
// A lógica de negócio (estado, efeitos, chamadas de API, websocket) permanece
// a mesma do page.js original — apenas a UI foi extraída para components/dashboard/*.

'use client';

import React, { useEffect, useState, useRef, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import type {
  AdvancedFilters,
  AlertItem,
  AlertType,
  BarChartDatum,
  ChartData,
  Device,
  HistoryEntry,
  LatencyTrend,
  SortDirection,
  SortField,
  StatusFilter,
  TelegramConfig,
  User,
} from '@/types/dashboard';

import LoadingScreen from '@/components/dashboard/LoadingScreen';
import { AlertToast, ReconnectingBanner } from '@/components/dashboard/AlertToast';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatusIndicators from '@/components/dashboard/StatusIndicators';
import KpiPanel from '@/components/dashboard/KpiPanel';
import DeviceFilters from '@/components/dashboard/DeviceFilters';
import AdvancedFiltersPanel from '@/components/dashboard/AdvancedFiltersPanel';
import AddDeviceForm from '@/components/dashboard/AddDeviceForm';
import DeviceTable from '@/components/dashboard/DeviceTable';
import LatencyBarChartCard from '@/components/dashboard/LatencyBarChartCard';
import UptimeHistoryCard from '@/components/dashboard/UptimeHistoryCard';
import StatusPieCard from '@/components/dashboard/StatusPieCard';
import AlertHistoryCard from '@/components/dashboard/AlertHistoryCard';
import DashboardFooter from '@/components/dashboard/DashboardFooter';
import AlertConfigModal from '@/components/dashboard/AlertConfigModal';
import TelegramConfigModal from '@/components/dashboard/TelegramConfigModal';

export default function Home() {
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement>(null);

  // States principais
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [addingDevice, setAddingDevice] = useState(false);
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const alertSound = true;
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [pingingDevice, setPingingDevice] = useState<Device['id'] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [alertThresholds, setAlertThresholds] = useState<Record<string, number>>({});
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [alertHistory, setAlertHistory] = useState<AlertItem[]>([]);
  const [selectedAlertDevice, setSelectedAlertDevice] = useState<Device | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState<Device['id'] | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({ enabled: false, botToken: '', chatId: '' });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [chartTimeWindow, setChartTimeWindow] = useState(60);

  const [filters, setFilters] = useState<AdvancedFilters>({
    minLatency: '',
    maxLatency: '',
    minUptime: '',
    tags: [],
  });

  const [latencyTrend, setLatencyTrend] = useState<LatencyTrend>({ value: 0, percentage: 0, direction: 'stable' });
  const [previousAvgLatency, setPreviousAvgLatency] = useState(0);

  const alertThresholdsRef = useRef(alertThresholds);
  const devicesRef = useRef(devices);

  useEffect(() => { alertThresholdsRef.current = alertThresholds; }, [alertThresholds]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showExportMenu && e.target instanceof Element && !e.target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    if (devices.length > 0) {
      const currentAvg = devices.filter(d => d.status === 'online' && d.latency).length > 0
        ? devices.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + (d.latency || 0), 0) / devices.filter(d => d.status === 'online' && d.latency).length
        : 0;

      if (previousAvgLatency > 0 && currentAvg > 0) {
        const percentageChange = ((currentAvg - previousAvgLatency) / previousAvgLatency) * 100;
        setLatencyTrend({
          value: Math.round(Math.abs(currentAvg - previousAvgLatency)),
          percentage: Math.abs(Math.round(percentageChange)),
          direction: percentageChange < 0 ? 'down' : percentageChange > 0 ? 'up' : 'stable',
        });
      }
      setPreviousAvgLatency(currentAvg);
    }
  }, [devices, previousAvgLatency]);

  const addAlert = (message: string, type: AlertType) => {
    const newAlert: AlertItem = { id: Date.now(), message, type, timestamp: new Date().toLocaleTimeString(), read: false };
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

  const playAlertSound = (type: AlertType) => {
    if (!alertSound) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextCtor();
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
    } catch (e) { /* noop */ }
  };

  const configureAlert = (deviceId: Device['id'], threshold: number) => {
    const newThresholds = { ...alertThresholds, [deviceId]: threshold };
    setAlertThresholds(newThresholds);
    localStorage.setItem(`orbnoc_thresholds_${user?.id}`, JSON.stringify(newThresholds));
    addAlert(`🔔 Alerta configurado: limite de ${threshold}ms`, 'success');
    setShowAlertConfig(false);
    setSelectedAlertDevice(null);
  };

  const removeAlertConfig = (deviceId: Device['id']) => {
    const newThresholds = { ...alertThresholds };
    delete newThresholds[deviceId as string];
    setAlertThresholds(newThresholds);
    localStorage.setItem(`orbnoc_thresholds_${user?.id}`, JSON.stringify(newThresholds));
    addAlert(`🔕 Alerta removido`, 'success');
  };

  const saveToHistory = (devicesList: Device[]) => {
    const timestamp = new Date().toLocaleString();
    const online = devicesList.filter(d => d.status === 'online').length;
    const offline = devicesList.filter(d => d.status === 'offline').length;
    const avgLatency = devicesList.filter(d => d.status === 'online' && d.latency).length > 0
      ? devicesList.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + (d.latency || 0), 0) / devicesList.filter(d => d.status === 'online' && d.latency).length
      : 0;
    const newEntry: HistoryEntry = { timestamp, online, offline, total: devicesList.length, uptime: devicesList.length > 0 ? Math.round((online / devicesList.length) * 100) : 0, avgLatency: Math.round(avgLatency) };
    setHistory(prev => [newEntry, ...prev].slice(0, 50));
    const savedHistory = localStorage.getItem(`orbnoc_history_${user?.id}`);
    const historyArray: HistoryEntry[] = savedHistory ? JSON.parse(savedHistory) : [];
    historyArray.unshift(newEntry);
    localStorage.setItem(`orbnoc_history_${user?.id}`, JSON.stringify(historyArray.slice(0, 50)));
  };

  const getChartData = (): ChartData => {
    const statusData = [
      { name: 'Online', value: devices.filter(d => d.status === 'online').length, color: '#10b981' },
      { name: 'Offline', value: devices.filter(d => d.status === 'offline').length, color: '#ef4444' },
    ];
    const timelineData = history.slice(0, 20).reverse().map(h => ({
      time: h.timestamp.split(' ')[1]?.slice(0, 5) || h.timestamp,
      online: h.online,
      offline: h.offline,
      uptime: h.uptime,
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
      if (!element) return;
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
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/alerts/telegram`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 403) {
        console.warn('Telegram config not available (403)');
        return;
      }

      if (response.ok) {
        const config = await response.json();
        setTelegramConfig({
          enabled: config.enabled || false,
          botToken: config.botToken || '',
          chatId: config.chatId || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar config Telegram:', error);
    }
  };

  const saveTelegramConfig = async (enabled: boolean, botToken: string, chatId: string) => {
    setSavingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/alerts/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled, botToken, chatId }),
      });

      if (response.status === 403) {
        addAlert('❌ Permissão negada para configurar Telegram', 'error');
        return;
      }

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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data: Device[] = await res.json();
        setDevices(data);
        if (data.length > 0 && !selectedDevice) setSelectedDevice(data[0]);
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

  const pingDevice = async (deviceId: Device['id']) => {
    setPingingDevice(deviceId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const threshold = alertThresholds[deviceId as string];

      if (threshold && data.latency_ms > threshold && data.status === 'online') {
        addAlert(`⚠️ Latência Crítica: ${data.name} atingiu ${data.latency_ms}ms`, 'warning');
      } else if (data.status === 'online') {
        addAlert(`📡 ${data.name}: ${data.latency_ms || 'N/A'}ms`, 'success');
      } else {
        addAlert(`🔴 ${data.name}: Host offline`, 'error');
      }

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
      Latência: d.latency ? `${d.latency}ms` : '—', Perda: `${d.packet_loss || 0}%`, Jitter: `${Math.round(d.jitter || 0)}ms`,
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

    let socket: any = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

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
          reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
          setConnected(true);
          setReconnecting(false);
          console.log('✅ WebSocket conectado');

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

        socket.on('devices_update', (updatedDevices: Device[]) => {
          updatedDevices.forEach(device => {
            const old = devicesRef.current.find(d => d.id === device.id);
            if (old && old.status !== device.status) {
              addAlert(`${device.status === 'offline' ? '🔴 Host Down' : '🟢 Host Up'}: ${device.name}`, device.status === 'offline' ? 'error' : 'success');
            }

            const threshold = alertThresholdsRef.current[device.id as string];
            if (threshold && (device.latency || 0) > threshold && device.status === 'online') {
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

  const addDevice = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Trava contra reenvio: se já existe uma requisição em andamento (usuário
    // apertou Enter/clicou "Salvar" de novo antes da resposta chegar), ignora
    // — evita a rajada de POSTs idênticos que víamos no console.
    if (addingDevice) return;

    const formData = new FormData(e.currentTarget);
    const payload = { name: formData.get('name'), ip: formData.get('ip'), location: formData.get('location') || '' };
    const formEl = e.currentTarget;
    setAddingDevice(true);
    setAddDeviceError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        formEl.reset();
        setShowForm(false);
        fetchDevices();
        addAlert(`🚀 Host "${payload.name}" adicionado!`, 'success');
      } else {
        // Mostra o motivo real que o backend devolveu (ex: "Dispositivo com
        // este IP já existe") em vez de um genérico "Erro ao adicionar host"
        // — sem isso o usuário não tem como saber por que falhou.
        const data = await res.json().catch(() => null);
        const message = data?.error || 'Erro ao adicionar host';
        setAddDeviceError(message);
        addAlert(`❌ ${message}`, 'error');
      }
    } catch (error) {
      setAddDeviceError('Erro ao salvar host');
      addAlert('❌ Erro ao salvar host', 'error');
    } finally {
      setAddingDevice(false);
    }
  };

  const removeDevice = async (id: Device['id'], name: string) => {
    if (confirm(`Remover definitivamente o host ${name}?`)) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/devices/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'status' ? 'desc' : 'asc');
    }
  };

  const getFilteredAndSortedDevices = useCallback((): Device[] => {
    let filtered = [...devices];

    if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(term) || d.ip.toLowerCase().includes(term) || (d.location && d.location.toLowerCase().includes(term)));
    }

    if (filters.minLatency && filters.minLatency !== '') {
      filtered = filtered.filter(d => (d.latency || 0) >= parseInt(filters.minLatency, 10));
    }
    if (filters.maxLatency && filters.maxLatency !== '') {
      filtered = filtered.filter(d => (d.latency || 0) <= parseInt(filters.maxLatency, 10));
    }

    filtered.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
        case 'ip': valA = a.ip; valB = b.ip; break;
        case 'status': valA = a.status === 'online' ? 1 : 0; valB = b.status === 'online' ? 1 : 0; break;
        case 'latency': valA = a.latency || Infinity; valB = b.latency || Infinity; break;
        default: valA = (a as any)[sortField]; valB = (b as any)[sortField];
      }
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return filtered;
  }, [devices, statusFilter, searchTerm, filters, sortField, sortDirection]);

  const getBarChartData = useCallback((): BarChartDatum[] => {
    try {
      const onlineDevices = getFilteredAndSortedDevices()
        .filter(d => d.status === 'online' && d.latency !== null && d.latency !== undefined && typeof d.latency === 'number')
        .sort((a, b) => (b.latency || 0) - (a.latency || 0))
        .slice(0, 15);

      return onlineDevices.map(d => ({
        name: d.name.length > 18 ? d.name.substring(0, 15) + '...' : d.name,
        fullName: d.name || 'Desconhecido',
        latency: d.latency || 0,
        status: d.status || 'offline',
        id: d.id || String(Math.random()),
      }));
    } catch (error) {
      console.error('Erro ao preparar dados do gráfico:', error);
      return [];
    }
  }, [getFilteredAndSortedDevices]);

  const barChartData = getBarChartData();

  if (!isAuthenticated || loading) {
    return <LoadingScreen />;
  }

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const filteredDevices = getFilteredAndSortedDevices();
  const avgLatency = devices.filter(d => d.status === 'online' && d.latency).length > 0
    ? devices.filter(d => d.status === 'online' && d.latency).reduce((acc, d) => acc + (d.latency || 0), 0) / devices.filter(d => d.status === 'online' && d.latency).length
    : 0;
  const chartData = getChartData();
  const unreadAlerts = alertHistory.filter(a => !a.read).length;
  const availability = devices.length ? Math.round((online / devices.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070b17] via-[#0b1220] to-[#070b17] text-slate-200" ref={dashboardRef}>

      <AlertToast show={showAlert} message={alertMessage} />
      <ReconnectingBanner reconnecting={reconnecting} connected={connected} />

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        <DashboardHeader
          connected={connected}
          user={user}
          refreshing={refreshing}
          showExportMenu={showExportMenu}
          isGeneratingPDF={isGeneratingPDF}
          telegramConfig={telegramConfig}
          onNavigate={(path) => router.push(path)}
          onRefresh={handleRefresh}
          onClearAlertHistory={clearAlertHistory}
          onToggleExportMenu={() => setShowExportMenu(!showExportMenu)}
          onExportCSV={exportToCSV}
          onGeneratePDF={generatePDF}
          onOpenTelegramModal={() => setShowTelegramModal(true)}
          onLogout={handleLogout}
        />

        <StatusIndicators
          connected={connected}
          lastUpdateTime={lastUpdateTime}
          deviceCount={devices.length}
          chartTimeWindow={chartTimeWindow}
          onChartTimeWindowChange={setChartTimeWindow}
        />

        <KpiPanel
          totalDevices={devices.length}
          online={online}
          offline={offline}
          availability={availability}
          avgLatency={avgLatency}
          latencyTrend={latencyTrend}
          history={history}
        />

        <DeviceFilters
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          showAdvancedFilters={showAdvancedFilters}
          onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
        />

        {showAdvancedFilters && (
          <AdvancedFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={() => setFilters({ minLatency: '', maxLatency: '', minUptime: '', tags: [] })}
          />
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Device Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#4F8CFF] rounded-full"></span>
                Dispositivos<span className="text-xs text-slate-400 font-normal">({filteredDevices.length})</span>
              </h2>
              <button onClick={() => { setShowForm(!showForm); setAddDeviceError(null); }} className="px-3 py-1.5 bg-[#4F8CFF] hover:bg-blue-500 text-white text-sm rounded-lg transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Adicionar
              </button>
            </div>

            {showForm && <AddDeviceForm onSubmit={addDevice} submitting={addingDevice} errorMessage={addDeviceError} />}

            <DeviceTable
              devices={filteredDevices}
              onSort={handleSort}
              expandedDevice={expandedDevice}
              onToggleExpand={(id) => setExpandedDevice(expandedDevice === id ? null : id)}
              pingingDevice={pingingDevice}
              onPingDevice={pingDevice}
              onRemoveDevice={removeDevice}
              alertThresholds={alertThresholds}
              onRemoveAlertConfig={removeAlertConfig}
              onOpenAlertConfig={(device) => { setSelectedAlertDevice(device); setShowAlertConfig(true); }}
            />
          </div>

          {/* Right - Analytics */}
          <div className="space-y-6">
            <LatencyBarChartCard
              barChartData={barChartData}
              hasOnlineDevices={devices.filter(d => d.status === 'online').length > 0}
              onTestAll={() => {
                const onlineDevices = getFilteredAndSortedDevices().filter(d => d.status === 'online');
                onlineDevices.forEach(d => pingDevice(d.id));
                addAlert(`📡 Testando ${onlineDevices.length} dispositivos...`, 'success');
              }}
            />

            <UptimeHistoryCard history={history} />

            <StatusPieCard statusData={chartData.statusData} />

            <AlertHistoryCard alertHistory={alertHistory} unreadAlerts={unreadAlerts} onClear={clearAlertHistory} />
          </div>
        </div>

        <DashboardFooter connected={connected} />
      </div>

      {showAlertConfig && selectedAlertDevice && (
        <AlertConfigModal
          device={selectedAlertDevice}
          currentThreshold={alertThresholds[selectedAlertDevice.id as string]}
          onClose={() => setShowAlertConfig(false)}
          onSave={configureAlert}
        />
      )}

      {showTelegramModal && (
        <TelegramConfigModal
          config={telegramConfig}
          saving={savingTelegram}
          onClose={() => setShowTelegramModal(false)}
          onSave={saveTelegramConfig}
        />
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
