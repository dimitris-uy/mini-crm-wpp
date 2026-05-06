'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/utils';
import type { Contact } from '@/lib/types';

function StatusBadge({ status }: { status: Contact['status'] }) {
  const isClient = status === 'client';
  const styles = isClient
    ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
    : 'bg-cyan-500/15 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {isClient ? 'Cliente' : 'Prospecto'}
    </span>
  );
}

function dateClass(isoDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (isoDate < today) return 'text-amber-400';
  if (isoDate === today) return 'text-cyan-400';
  return 'text-zinc-400';
}

export function FollowUpList() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Contact[]>('/contacts')
      .then((all) => {
        const today = new Date().toISOString().slice(0, 10);
        const due = all
          .filter((c) => c.follow_up_date && c.follow_up_date <= today)
          .sort((a, b) => (a.follow_up_date! > b.follow_up_date! ? 1 : -1));
        setContacts(due);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-100">
        Seguimientos Pendientes
      </h2>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
          Error al cargar: {error}
        </div>
      )}

      {!error && contacts === null && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-900" />
          ))}
        </div>
      )}

      {!error && contacts !== null && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-12 text-zinc-500">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-3 text-zinc-600"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="m9 16 2 2 4-4" />
          </svg>
          <p className="text-sm">Sin seguimientos programados</p>
        </div>
      )}

      {!error && contacts !== null && contacts.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 font-medium text-zinc-400">Nombre</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-400 sm:table-cell">Telefono</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Fecha</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-400 sm:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {contacts.map((c) => {
                const overdue = c.follow_up_date! < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={c.jid} className="bg-zinc-900 transition-colors hover:bg-zinc-800/50 [&>td]:min-h-[48px]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${encodeURIComponent(c.jid)}`}
                        className="font-medium text-zinc-100 hover:text-cyan-400 transition-colors duration-150"
                      >
                        {c.name || formatPhone(c.phone)}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                      {formatPhone(c.phone)}
                    </td>
                    <td className={`px-4 py-3 font-medium ${dateClass(c.follow_up_date!)}`}>
                      {formatDate(c.follow_up_date!)}
                      {overdue && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                          Vencido
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
