'use client';

import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StatusFilter } from '@/types/dashboard';

interface DeviceFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
}

const OPTIONS: { value: StatusFilter; label: string; active: string }[] = [
  { value: 'all', label: 'Todos', active: 'bg-primary text-white' },
  { value: 'online', label: 'Online', active: 'bg-emerald-600 text-white' },
  { value: 'offline', label: 'Offline', active: 'bg-rose-600 text-white' },
];

export default function DeviceFilters({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
}: DeviceFiltersProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row">
      <div className="relative w-full sm:w-96">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar host, IP ou localização..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="h-10 pl-10"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-600/70 bg-slate-800/30 p-1">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onStatusFilterChange(o.value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${statusFilter === o.value ? o.active : 'text-slate-400 hover:text-slate-200'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={onToggleAdvancedFilters}
          className={showAdvancedFilters ? 'border-blue-500/30 bg-blue-600/20 text-blue-300' : 'text-slate-400'}
        >
          <Filter /> Filtros
        </Button>
      </div>
    </div>
  );
}
