'use client';

import { useDebounce } from '@/hooks/useDebounce';
import { useEffect, useState } from 'react';

export interface ContactFilters {
  status: 'all' | 'prospect' | 'client';
  search: string;
  inactiveOnly: boolean;
}

interface ContactsFiltersProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
}

export function ContactsFilters({ filters, onChange }: ContactsFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Status dropdown */}
      <select
        value={filters.status}
        onChange={(e) =>
          onChange({
            ...filters,
            status: e.target.value as ContactFilters['status'],
          })
        }
        className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none transition-colors hover:border-zinc-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
      >
        <option value="all">Todos</option>
        <option value="prospect">Prospectos</option>
        <option value="client">Clientes</option>
      </select>

      {/* Search input */}
      <div className="relative flex-1 sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por nombre o telefono..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
        />
      </div>

      {/* Inactive toggle */}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400 select-none">
        <button
          type="button"
          role="switch"
          aria-checked={filters.inactiveOnly}
          onClick={() =>
            onChange({ ...filters, inactiveOnly: !filters.inactiveOnly })
          }
          className={`relative h-5 w-9 rounded-full transition-colors ${
            filters.inactiveOnly ? 'bg-amber-500' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              filters.inactiveOnly ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        Solo inactivos
      </label>
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
