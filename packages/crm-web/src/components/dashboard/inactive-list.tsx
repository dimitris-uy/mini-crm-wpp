'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { timeAgo, formatPhone } from '@/lib/utils';
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

export function InactiveList() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Contact[]>('/contacts?inactive_days=7&sort=last_reply')
      .then((data) => setContacts(data.slice(0, 10)))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-100">
        Requieren Atencion
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
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-sm">Todos los contactos estan activos</p>
        </div>
      )}

      {!error && contacts !== null && contacts.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 font-medium text-zinc-400">Nombre</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-400 sm:table-cell">Telefono</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Ultima respuesta</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-400 sm:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {contacts.map((c) => (
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
                  <td className="px-4 py-3 text-amber-400">
                    {c.last_reply_at ? timeAgo(c.last_reply_at) : 'Nunca'}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
