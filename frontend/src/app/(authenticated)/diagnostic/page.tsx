'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Activity, Globe, Loader2, Play, Plug, Route, ScanSearch, Wrench } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch, errorMessage } from '@/lib/api';
import { formatMs } from '@/lib/latency';

type Tab = 'ping' | 'traceroute' | 'port' | 'dns' | 'full';

interface PingResult { status: 'online' | 'offline'; method: string; packet_loss: number; avg_latency: number | null; min_latency: number | null; max_latency: number | null; success_count: number; total_count: number; address: string }
interface TraceResult { target: string; address: string; hops: { hop: number; ip: string | null; latency: number | null }[] }
interface PortResult { host: string; results: { port: number; open: boolean; latency: number | null }[] }
interface DnsResult { domain: string; record_type: string; records: { value: string }[]; success: boolean; error?: string }
interface FullResult { host: string; address: string; duration_ms: number; diagnosis: string[] }

const TABS: { id: Tab; name: string; icon: typeof Activity }[] = [
  { id: 'ping', name: 'Ping', icon: Activity },
  { id: 'traceroute', name: 'Traceroute', icon: Route },
  { id: 'port', name: 'Portas', icon: Plug },
  { id: 'dns', name: 'DNS', icon: Globe },
  { id: 'full', name: 'Diagnóstico completo', icon: ScanSearch },
];

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'];

function parsePorts(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

export default function DiagnosticPage() {
  const [tab, setTab] = useState<Tab>('ping');
  const [host, setHost] = useState('');
  const [ports, setPorts] = useState('443');
  const [recordType, setRecordType] = useState('A');
  const [result, setResult] = useState<unknown>(null);

  const run = useMutation({
    mutationFn: async () => {
      const target = host.trim();
      switch (tab) {
        case 'ping':
          return apiFetch<PingResult>('/api/diagnostic/ping', { method: 'POST', body: { host: target, count: 5 } });
        case 'traceroute':
          return apiFetch<TraceResult>('/api/diagnostic/traceroute', { method: 'POST', body: { host: target } });
        case 'port':
          return apiFetch<PortResult>('/api/diagnostic/port-check', { method: 'POST', body: { host: target, ports: parsePorts(ports) } });
        case 'dns':
          return apiFetch<DnsResult>('/api/diagnostic/dns-lookup', { method: 'POST', body: { domain: target, record_type: recordType } });
        default:
          return apiFetch<FullResult>('/api/diagnostic/full-diagnostic', { method: 'POST', body: { host: target, ports: [80, 443, 22] } });
      }
    },
    onMutate: () => setResult(null),
    onSuccess: setResult,
  });

  const changeTab = (next: string) => {
    setTab(next as Tab);
    setResult(null);
    run.reset();
  };

  return (
    <PageShell title="Diagnóstico avançado" subtitle="Ferramentas de rede para troubleshooting (sem shell, com host validado)" icon={<Wrench />} maxWidth="max-w-6xl">
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              <t.icon /> {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <form
        className="mb-6 rounded-xl border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate();
        }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="diag-host">{tab === 'dns' ? 'Domínio' : 'Host / IP'}</Label>
            <Input id="diag-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder={tab === 'dns' ? 'exemplo.com' : '8.8.8.8 ou exemplo.com'} required autoComplete="off" spellCheck={false} />
          </div>
          {tab === 'port' && (
            <div className="w-48 space-y-1">
              <Label htmlFor="diag-ports">Portas (separe por vírgula)</Label>
              <Input id="diag-ports" value={ports} onChange={(e) => setPorts(e.target.value)} placeholder="80, 443, 22" required />
            </div>
          )}
          {tab === 'dns' && (
            <div className="w-32 space-y-1">
              <Label htmlFor="diag-type">Tipo</Label>
              <Select value={recordType} onValueChange={setRecordType}>
                <SelectTrigger id="diag-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" disabled={run.isPending || host.trim() === ''} className="px-6">
            {run.isPending ? <Loader2 className="animate-spin" /> : <Play />} {run.isPending ? 'Executando...' : 'Executar'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-subtle">Loopback, link-local e endereços de metadata de nuvem são bloqueados. Limite: 30 execuções por minuto.</p>
      </form>

      <div aria-live="polite">
        {run.isError && <div role="alert" className="rounded-xl border border-bad/25 bg-bad/10 p-4 text-sm text-bad">{errorMessage(run.error)}</div>}
        {result !== null && (
          <div className="animate-fade-in rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Resultado</h2>
              <button type="button" onClick={() => setResult(null)} className="text-xs text-subtle hover:text-foreground">
                Limpar
              </button>
            </div>
            <Results tab={tab} data={result} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Stat({ label, value, color = 'text-foreground' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Results({ tab, data }: { tab: Tab; data: unknown }) {
  if (tab === 'ping') {
    const r = data as PingResult;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Status" value={r.status === 'online' ? 'Online' : 'Offline'} color={r.status === 'online' ? 'text-ok' : 'text-bad'} />
          <Stat label="Perda de pacotes" value={`${r.packet_loss}%`} color={r.packet_loss > 0 ? 'text-warn' : 'text-foreground'} />
          <Stat label="Latência média" value={formatMs(r.avg_latency)} color="text-foreground" />
          <Stat label="Mín / Máx" value={`${formatMs(r.min_latency)} / ${formatMs(r.max_latency)}`} />
        </div>
        <p className="text-sm text-muted-foreground">
          {r.success_count}/{r.total_count} respostas • método {r.method.toUpperCase()} • {r.address}
        </p>
      </div>
    );
  }
  if (tab === 'traceroute') {
    const r = data as TraceResult;
    return (
      <ol className="max-h-96 space-y-2 overflow-y-auto">
        <li className="mb-2 text-xs text-subtle">
          Caminho até {r.target} ({r.address})
        </li>
        {r.hops.map((h) => (
          <li key={h.hop} className="flex items-center gap-3 rounded-lg bg-muted p-2">
            <span className="w-8 text-xs text-subtle">#{h.hop}</span>
            <span className="flex-1 font-mono text-sm text-foreground">{h.ip ?? '* * *'}</span>
            <span className={`text-xs ${h.latency != null ? 'text-ok' : 'text-bad'}`}>{h.latency != null ? formatMs(h.latency) : 'timeout'}</span>
          </li>
        ))}
        {r.hops.length === 0 && <li className="text-sm text-subtle">Nenhum salto retornado.</li>}
      </ol>
    );
  }
  if (tab === 'port') {
    const r = data as PortResult;
    return (
      <ul className="rounded-lg bg-muted p-3">
        {r.results.map((p) => (
          <li key={p.port} className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
            <span className="font-mono text-foreground">Porta {p.port}</span>
            <span className={p.open ? 'text-ok' : 'text-bad'}>{p.open ? 'Aberta' : 'Fechada'}</span>
            <span className="w-16 text-right text-xs text-subtle">{p.latency != null ? formatMs(p.latency) : ''}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (tab === 'dns') {
    const r = data as DnsResult;
    return (
      <div className="rounded-lg bg-muted p-3">
        <p className="mb-1 text-xs text-subtle">
          Registros {r.record_type} de {r.domain}
        </p>
        {r.records.map((rec) => (
          <div key={rec.value} className="py-1 font-mono text-sm break-all text-ok">
            {rec.value}
          </div>
        ))}
        {!r.success && <p className="text-sm text-bad">Sem resultado: {r.error ?? 'não encontrado'}</p>}
      </div>
    );
  }
  const r = data as FullResult;
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs text-subtle">
        Diagnóstico de {r.host} ({r.address})
      </p>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {r.diagnosis.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-subtle">Tempo total: {r.duration_ms}ms</p>
    </div>
  );
}
