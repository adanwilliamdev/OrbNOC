'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import SlaTable from '@/components/reports/SlaTable';
import { Button } from '@/components/ui/button';
import { useReportSummary } from '@/hooks/use-alerts';
import { pct } from '@/lib/format';
import type { SlaWindow } from '@/types/dashboard';

const VALID: SlaWindow[] = ['24h', '7d', '30d'];

/** Tela de impressão: o PDF é o "salvar como PDF" do navegador (sem captura de tela). */
function PrintReport() {
  const param = useSearchParams().get('window');
  const window_ = (VALID.includes(param as SlaWindow) ? param : '24h') as SlaWindow;
  const { data, isLoading } = useReportSummary(window_);

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-slate-900 print:max-w-none print:p-0 [&_*]:!text-slate-900 [&_table]:!bg-white [&_thead]:!bg-slate-100 [&_div]:!bg-white [&_div]:!border-slate-300 [&_td]:!border-slate-300 [&_tr]:!border-slate-300">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline" className="!bg-white">
          <Link href="/reports">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
        <Button onClick={() => globalThis.print()}>
          <Printer /> Imprimir / salvar como PDF
        </Button>
      </div>
      <h1 className="text-2xl font-bold">OrbNOC — Relatório de SLA</h1>
      <p className="mb-4 text-sm">
        Janela: {window_} • Gerado em {data ? new Date(data.generated_at).toLocaleString() : '—'} • Dispositivos: {data?.total_devices ?? 0} • Uptime médio: {pct(data?.average_uptime_pct ?? null)}
      </p>
      <SlaTable rows={data?.devices ?? []} window={window_} loading={isLoading} />
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintReport />
    </Suspense>
  );
}
