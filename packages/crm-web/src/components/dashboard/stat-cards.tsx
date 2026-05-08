'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getLabelColor } from '@/lib/label-colors';
import type { DashboardStats } from '@/lib/types';

interface StatCard {
  label: string;
  key: 'total' | 'pendingFollowUps' | 'inactive';
  icon: React.ReactNode;
  color: string;
  bg: string;
  borderColor: string;
  shadowColor: string;
}

const cards: StatCard[] = [
  {
    label: 'Total Contactos',
    key: 'total',
    color: 'text-zinc-300',
    bg: 'bg-zinc-800/50',
    borderColor: 'hover:border-zinc-600',
    shadowColor: '',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Seguimientos Pendientes',
    key: 'pendingFollowUps',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    borderColor: 'hover:border-amber-800',
    shadowColor: 'hover:shadow-[0_0_12px_rgba(251,191,36,0.15)]',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Inactivos (7+ dias)',
    key: 'inactive',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    borderColor: 'hover:border-rose-800',
    shadowColor: 'hover:shadow-[0_0_12px_rgba(248,113,113,0.15)]',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

export function StatCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardStats>('/dashboard')
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
        Error al cargar estadisticas: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className={`rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-5 transition-all duration-150 ${card.borderColor} ${card.shadowColor}`}
          >
            <div className={`mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
              {card.icon}
            </div>
            {stats === null ? (
              <div className="space-y-2">
                <div className="h-8 w-16 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
              </div>
            ) : (
              <>
                <p className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${card.color}`}>
                  {stats[card.key]}
                </p>
                <p className="mt-1 text-xs sm:text-sm text-zinc-500">{card.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Label breakdown */}
      {stats && stats.labels.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-400">Etiquetas de WhatsApp</h3>
          <div className="flex flex-wrap gap-2">
            {stats.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{
                  backgroundColor: getLabelColor(label.color) + '20',
                  color: getLabelColor(label.color),
                }}
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getLabelColor(label.color) }}
                />
                {label.name}
                <span className="ml-1 text-xs opacity-70">{label.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
