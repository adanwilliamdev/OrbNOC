'use client';

import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StatusFilter } from '@/types/dashboard';

interface DeviceFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
}

const OPTIONS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'online', label: 'Online', dot: 'bg-ok' },
  { value: 'offline', label: 'Offline', dot: 'bg-bad' },
];

export default function DeviceFilters({ searchTerm, onSearchTermChange, statusFilter, onStatusFilterChange, showAdvancedFilters, onToggleAdvancedFilters }: DeviceFiltersProps) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row">
      <div className="relative w-full sm:w-96">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <Input placeholder="Buscar host, IP ou localização" aria-label="Buscar dispositivos" value={searchTerm} onChange={(e) => onSearchTermChange(e.target.value)} className="h-10 pl-9" />
      </div>
      <div className="flex gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filtrar por estado">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={statusFilter === o.value}
              onClick={() => onStatusFilterChange(o.value)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150',
                statusFilter === o.value ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.05)]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.dot && <span className={cn('size-1.5 rounded-full', o.dot)} />}
              {o.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onToggleAdvancedFilters} aria-pressed={showAdvancedFilters} className={cn('h-10', showAdvancedFilters && 'border-primary/40 text-primary')}>
          <Filter /> Filtros
        </Button>
      </div>
    </div>
  );
}
