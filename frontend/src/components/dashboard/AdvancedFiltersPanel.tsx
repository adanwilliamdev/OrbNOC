'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdvancedFilters } from '@/types/dashboard';

interface AdvancedFiltersPanelProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
}

export default function AdvancedFiltersPanel({ filters, onFiltersChange }: AdvancedFiltersPanelProps) {
  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="min-latency">Latência Mínima (ms)</Label>
          <Input id="min-latency" type="number" placeholder="0" value={filters.minLatency} onChange={(e) => onFiltersChange({ ...filters, minLatency: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="max-latency">Latência Máxima (ms)</Label>
          <Input id="max-latency" type="number" placeholder="100" value={filters.maxLatency} onChange={(e) => onFiltersChange({ ...filters, maxLatency: e.target.value })} />
        </div>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => onFiltersChange({ minLatency: '', maxLatency: '' })}>
            Limpar Filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
