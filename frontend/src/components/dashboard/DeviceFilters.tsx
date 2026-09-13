'use client';

import type { StatusFilter } from '@/types/dashboard';

interface DeviceFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
}

export default function DeviceFilters({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
}: DeviceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between gap-4">
      <div className="relative w-full sm:w-96">
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          placeholder="Buscar host, IP ou localização..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="w-full bg-[#121a2b] border border-slate-600/70 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-200 placeholder:text-slate-500"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex gap-1 bg-slate-800/30 p-1 rounded-lg border border-slate-600/70">
          <button onClick={() => onStatusFilterChange('all')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-[#4F8CFF] text-white' : 'text-slate-400 hover:text-slate-200'}`}>Todos</button>
          <button onClick={() => onStatusFilterChange('online')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Online</button>
          <button onClick={() => onStatusFilterChange('offline')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'offline' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Offline</button>
        </div>
        <button onClick={onToggleAdvancedFilters} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${showAdvancedFilters ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'bg-[#121a2b] text-slate-400 border border-slate-600/70 hover:border-slate-500'}`}>
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filtros
        </button>
      </div>
    </div>
  );
}
