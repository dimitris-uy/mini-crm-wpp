'use client';

import Link from 'next/link';
import type { Contact } from '@/lib/types';
import { formatDate, formatPhone } from '@/lib/utils';

interface FollowUpListViewProps {
  contacts: Contact[];
  loading: boolean;
  onReschedule: (contact: Contact) => void;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateBadge(isoDate: string): { label: string; className: string } | null {
  const today = getToday();
  if (isoDate < today) {
    return { label: 'Vencido', className: 'bg-rose-500/15 text-rose-400' };
  }
  if (isoDate === today) {
    return { label: 'Hoy', className: 'bg-cyan-500/15 text-cyan-400' };
  }
  return null;
}

function dateColor(isoDate: string): string {
  const today = getToday();
  if (isoDate < today) return 'text-rose-400';
  if (isoDate === today) return 'text-cyan-400';
  return 'text-zinc-400';
}

export function FollowUpListView({ contacts, loading, onReschedule }: FollowUpListViewProps) {
  // Sort by follow_up_date ascending (overdue first)
  const sorted = [...contacts].sort((a, b) => {
    const da = a.follow_up_date!;
    const db = b.follow_up_date!;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="divide-y divide-zinc-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-4 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:gap-4">
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-800 sm:hidden" />
              </div>
              <div className="hidden sm:block">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
              </div>
              <div className="hidden sm:block">
                <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
              </div>
              <div className="hidden sm:block">
                <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
              </div>
              <div className="hidden sm:block">
                <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
          <CalendarEmptyIcon />
        </div>
        <p className="text-sm font-medium text-zinc-300">
          No hay seguimientos para estos filtros
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <th className="px-4 py-3 font-medium text-zinc-400">Nombre</th>
            <th className="hidden px-4 py-3 font-medium text-zinc-400 sm:table-cell">
              Telefono
            </th>
            <th className="px-4 py-3 font-medium text-zinc-400">
              Fecha de seguimiento
            </th>
            <th className="hidden px-4 py-3 font-medium text-zinc-400 sm:table-cell">
              Estado
            </th>
            <th className="px-4 py-3 font-medium text-zinc-400">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {sorted.map((contact) => {
            const badge = dateBadge(contact.follow_up_date!);
            return (
              <tr
                key={contact.jid}
                className="bg-zinc-900 transition-colors hover:bg-zinc-800/50 [&>td]:min-h-[48px]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/contacts/${encodeURIComponent(contact.jid)}`}
                    className="font-medium text-zinc-100 transition-colors duration-150 hover:text-cyan-400"
                  >
                    {contact.name || formatPhone(contact.phone)}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                  {formatPhone(contact.phone)}
                </td>
                <td className={`px-4 py-3 font-medium ${dateColor(contact.follow_up_date!)}`}>
                  {formatDate(contact.follow_up_date!)}
                  {badge && (
                    <span
                      className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <StatusBadge status={contact.status} />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onReschedule(contact)}
                    className="rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-[0.97]"
                  >
                    Reprogramar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: Contact['status'] }) {
  const isClient = status === 'client';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isClient
          ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
          : 'bg-cyan-500/15 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
      }`}
    >
      {isClient ? 'Cliente' : 'Prospecto'}
    </span>
  );
}

function CalendarEmptyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-zinc-500"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
