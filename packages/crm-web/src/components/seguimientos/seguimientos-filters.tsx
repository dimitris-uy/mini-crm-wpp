'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export interface SeguimientoFilters {
  dateRange: 'overdue' | 'today' | 'week' | 'all';
  status: 'all' | 'prospect' | 'client';
  search: string;
}

interface SeguimientosFiltersProps {
  filters: SeguimientoFilters;
  onChange: (filters: SeguimientoFilters) => void;
}

export function SeguimientosFilters({ filters, onChange }: SeguimientosFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Date range */}
      <select
        value={filters.dateRange}
        onChange={(e) =>
          onChange({
            ...filters,
            dateRange: e.target.value as SeguimientoFilters['dateRange'],
          })
        }
        className="h-11 sm:h-9 w-full sm:w-auto rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none transition-colors hover:border-zinc-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
      >
        <option value="all">Todos</option>
        <option value="overdue">Vencidos</option>
        <option value="today">Hoy</option>
        <option value="week">Esta semana</option>
      </select>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) =>
          onChange({
            ...filters,
            status: e.target.value as SeguimientoFilters['status'],
          })
        }
        className="h-11 sm:h-9 w-full sm:w-auto rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none transition-colors hover:border-zinc-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
      >
        <option value="all">Todos</option>
        <option value="prospect">Prospectos</option>
        <option value="client">Clientes</option>
      </select>

      {/* Search */}
      <div className="relative w-full sm:flex-1 sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por nombre o telefono..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-11 sm:h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
        />
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
