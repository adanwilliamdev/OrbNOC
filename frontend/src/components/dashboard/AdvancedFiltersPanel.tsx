'use client';

import type { AdvancedFilters } from '@/types/dashboard';

interface AdvancedFiltersPanelProps {
  filters: AdvancedFilters;
  onFiltersChange: (updater: (prev: AdvancedFilters) => AdvancedFilters) => void;
  onClearFilters: () => void;
}

export default function AdvancedFiltersPanel({ filters, onFiltersChange, onClearFilters }: AdvancedFiltersPanelProps) {
  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-600/70 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Latência Mínima (ms)</label>
          <input
            type="number"
            placeholder="0"
            value={filters.minLatency}
            onChange={(e) => onFiltersChange((prev) => ({ ...prev, minLatency: e.target.value }))}
            className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Latência Máxima (ms)</label>
          <input
            type="number"
            placeholder="100"
            value={filters.maxLatency}
            onChange={(e) => onFiltersChange((prev) => ({ ...prev, maxLatency: e.target.value }))}
            className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-end">
          <button onClick={onClearFilters} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors text-slate-300">
            Limpar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
