'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import AppBar from '@/components/layout/AppBar';
import AddDeviceForm from '@/components/dashboard/AddDeviceForm';
import AdvancedFiltersPanel from '@/components/dashboard/AdvancedFiltersPanel';
import AlertConfigModal from '@/components/dashboard/AlertConfigModal';
import AlertHistoryCard from '@/components/dashboard/AlertHistoryCard';
import DashboardFooter from '@/components/dashboard/DashboardFooter';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DeviceFilters from '@/components/dashboard/DeviceFilters';
import DeviceTable from '@/components/dashboard/DeviceTable';
import KpiPanel from '@/components/dashboard/KpiPanel';
import LatencyBarChartCard from '@/components/dashboard/LatencyBarChartCard';
import StatusIndicators from '@/components/dashboard/StatusIndicators';
import StatusPieCard from '@/components/dashboard/StatusPieCard';
import TelegramConfigModal from '@/components/dashboard/TelegramConfigModal';
import UptimeHistoryCard from '@/components/dashboard/UptimeHistoryCard';
import { Button } from '@/components/ui/button';
import { useAckAlerts, useAlerts, useTelegram, useUptimeSeries } from '@/hooks/use-alerts';
import { useAddDevice, useConfigureSla, useDevices, usePingDevice, useRemoveDevice } from '@/hooks/use-devices';
import { errorMessage } from '@/lib/api';
import { downloadFile, filterAndSort, toBarChartData } from '@/lib/devices';
import { formatMs } from '@/lib/latency';
import { chart } from '@/lib/theme';
import { cn, stagger } from '@/lib/utils';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';
import { useStream } from '@/providers/stream-provider';
import type { AdvancedFilters, Device, LatencyTrend, SortDirection, SortField, StatusFilter, StatusDatum } from '@/types/dashboard';

const NO_TREND: LatencyTrend = { value: 0, percentage: 0, direction: 'stable' };

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connected, lastUpdate } = useStream();
  const { devices, stats, isFetching, refetch } = useDevices();
  const { alerts, unread } = useAlerts(50);
  const { ackAll } = useAckAlerts();
  const { data: history = [] } = useUptimeSeries(24);
  const telegram = useTelegram();
  const addDevice = useAddDevice();
  const removeDevice = useRemoveDevice();
  const pingDevice = usePingDevice();
  const configureSla = useConfigureSla();

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedFilters>({ minLatency: '', maxLatency: '' });
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pinging, setPinging] = useState<number | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [slaDevice, setSlaDevice] = useState<Device | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  // Só renderiza no cliente (atrás do guard de sessão), então ler o localStorage aqui é seguro.
  const [sound, setSound] = useState(() => isSoundEnabled());

  // Tendência da latência média entre atualizações (derivada, sem estado extra).
  const previousAvg = useRef<number | null>(null);
  const [trend, setTrend] = useState<LatencyTrend>(NO_TREND);
  useEffect(() => {
    const current = stats.avgLatency;
    if (current === null) return;
    const previous = previousAvg.current;
    if (previous !== null && previous > 0 && current !== previous) {
      const pct = ((current - previous) / previous) * 100;
      setTrend({ value: Math.round(Math.abs(current - previous)), percentage: Math.abs(Math.round(pct)), direction: pct < 0 ? 'down' : 'up' });
    }
    previousAvg.current = current;
  }, [stats.avgLatency]);

  const visible = useMemo(
    () => filterAndSort(devices, { search: searchTerm, status: statusFilter, advanced, sortField, sortDirection }),
    [devices, searchTerm, statusFilter, advanced, sortField, sortDirection],
  );
  const barChartData = useMemo(() => toBarChartData(visible), [visible]);
  const statusData: StatusDatum[] = useMemo(
    () => [
      { name: 'Online', value: stats.online, color: chart.ok },
      { name: 'Offline', value: stats.offline, color: chart.bad },
      ...(stats.unknown > 0 ? [{ name: 'Aguardando', value: stats.unknown, color: chart.idle }] : []),
    ],
    [stats],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection(field === 'status' ? 'desc' : 'asc');
    }
  };

  const handleAdd = (device: Parameters<typeof addDevice.mutate>[0]) => {
    addDevice.mutate(device, {
      onSuccess: (created) => {
        setShowForm(false);
        toast.success(`${created.name} adicionado ao monitoramento`);
      },
    });
  };

  const handleRemove = (id: number, name: string) => {
    if (!window.confirm(`Remover "${name}" do monitoramento?`)) return;
    removeDevice.mutate(id, {
      onSuccess: () => toast.success(`${name} removido`),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const handlePing = (id: number) => {
    setPinging(id);
    pingDevice.mutate(id, {
      onSuccess: (r) => (r.status === 'online' ? toast.success(`${r.name}: ${formatMs(r.latency_ms)} (${r.method.toUpperCase()})`) : toast.error(`${r.name}: sem resposta`)),
      onError: (e) => toast.error(errorMessage(e)),
      onSettled: () => setPinging(null),
    });
  };

  const handleTestAll = async () => {
    const targets = devices.filter((d) => d.status === 'online');
    if (targets.length === 0) return;
    setTestingAll(true);
    const results = await Promise.allSettled(targets.map((d) => pingDevice.mutateAsync(d.id)));
    setTestingAll(false);
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'online').length;
    toast.info(`Teste concluído: ${ok}/${targets.length} responderam`);
  };

  const handleSaveSla = (deviceId: number, threshold: number) => {
    configureSla.mutate(
      { device_id: deviceId, threshold_ms: threshold },
      {
        onSuccess: (r) => {
          setSlaDevice(null);
          toast.success(r.message);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const handleRemoveSla = (deviceId: number) =>
    configureSla.mutate({ device_id: deviceId, threshold_ms: null }, { onSuccess: () => toast.success('Alerta SLA removido'), onError: (e) => toast.error(errorMessage(e)) });

  const saveTelegram = telegram.save.mutateAsync;
  const handleSaveTelegram = useCallback(
    async (input: Parameters<typeof saveTelegram>[0]) => {
      setTelegramError(null);
      try {
        const result = await saveTelegram(input);
        if (!input.enabled) toast.success('Telegram desativado');
        else if (result.test_sent) toast.success('Telegram configurado — mensagem de teste enviada');
        else toast.warning(`Salvo, mas o teste falhou: ${result.test_error ?? 'erro desconhecido'}`);
        return true;
      } catch (e) {
        setTelegramError(errorMessage(e));
        return false;
      }
    },
    [saveTelegram],
  );

  const handleExport = (format: 'csv' | 'xlsx') => {
    downloadFile(`/api/reports/export?format=${format}&window=24h`);
  };

  const handleRefresh = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['uptime-series'] });
  };

  return (
    <div className="min-h-screen">
      <AppBar />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <DashboardHeader
          refreshing={isFetching}
          unreadAlerts={unread}
          soundEnabled={sound}
          telegramConfig={telegram.config}
          meta={<StatusIndicators connected={connected} lastUpdateTime={lastUpdate} deviceCount={stats.total} />}
          onRefresh={handleRefresh}
          onAckAll={() => ackAll.mutate()}
          onToggleSound={() => {
            setSoundEnabled(!sound);
            setSound(!sound);
          }}
          onExport={handleExport}
          onPrint={() => router.push('/reports/print')}
          onOpenTelegramModal={() => {
            setTelegramError(null);
            setTelegramOpen(true);
          }}
        />

        <KpiPanel devices={devices} totalDevices={stats.total} online={stats.online} offline={stats.offline} availability={stats.availability} avgLatency={stats.avgLatency} latencyTrend={trend} history={history} />

        <div className="reveal grid grid-cols-1 gap-6 lg:grid-cols-3" style={stagger(5)}>
          <div className="space-y-6 lg:col-span-2">
            <LatencyBarChartCard barChartData={barChartData} hasOnlineDevices={stats.online > 0} testing={testingAll} onTestAll={() => void handleTestAll()} />
            <UptimeHistoryCard history={history} />
          </div>
          <div className="space-y-6">
            <StatusPieCard statusData={statusData} />
            <AlertHistoryCard alerts={alerts} unread={unread} onAckAll={() => ackAll.mutate()} />
          </div>
        </div>

        <section aria-label="Dispositivos" className="reveal space-y-4" style={stagger(6)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              Dispositivos
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{visible.length}</span>
            </h2>
            <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'secondary' : 'default'}>
              <Plus className={cn('transition-transform duration-200', showForm && 'rotate-45')} /> {showForm ? 'Fechar' : 'Adicionar'}
            </Button>
          </div>
          {showForm && <AddDeviceForm onSubmit={handleAdd} submitting={addDevice.isPending} errorMessage={addDevice.error ? errorMessage(addDevice.error) : null} />}
          <DeviceFilters
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showAdvancedFilters={showAdvanced}
            onToggleAdvancedFilters={() => setShowAdvanced((v) => !v)}
          />
          {showAdvanced && <AdvancedFiltersPanel filters={advanced} onFiltersChange={setAdvanced} />}
          <DeviceTable
            devices={visible}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            expandedDevice={expanded}
            onToggleExpand={(id) => setExpanded((cur) => (cur === id ? null : id))}
            pingingDevice={pinging}
            onPingDevice={handlePing}
            onRemoveDevice={handleRemove}
            onRemoveAlertConfig={handleRemoveSla}
            onOpenAlertConfig={setSlaDevice}
          />
        </section>

        <DashboardFooter connected={connected} />
      </div>

      <AlertConfigModal device={slaDevice} saving={configureSla.isPending} onClose={() => setSlaDevice(null)} onSave={handleSaveSla} />
      <TelegramConfigModal open={telegramOpen} config={telegram.config} saving={telegram.save.isPending} error={telegramError} onClose={() => setTelegramOpen(false)} onSave={handleSaveTelegram} />
    </div>
  );
}

