'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getLabelColor } from '@/lib/label-colors';
import type { Contact, Label } from '@/lib/types';
import { timeAgo, formatDate, formatPhone } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ContactsFilters, type ContactFilters } from './contacts-filters';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isInactive(contact: Contact): boolean {
  if (!contact.last_reply_at) return true;
  return Date.now() - contact.last_reply_at > SEVEN_DAYS_MS;
}

export function ContactsTable() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ContactFilters>({
    labelId: null,
    search: '',
    inactiveOnly: false,
  });

  const { lastEvent } = useWebSocket();

  const fetchContacts = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.labelId) params.set('label', filters.labelId);
    if (filters.search) params.set('search', filters.search);
    if (filters.inactiveOnly) params.set('inactive', '1');

    const query = params.toString();
    const path = `/contacts${query ? `?${query}` : ''}`;

    apiFetch<Contact[]>(path)
      .then(setContacts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  // Fetch on filter change
  useEffect(() => {
    setLoading(true);
    fetchContacts();
  }, [fetchContacts]);

  // Real-time updates
  useEffect(() => {
    if (!lastEvent) return;

    if (
      lastEvent.type === 'contact:update' ||
      lastEvent.type === 'message:new' ||
      lastEvent.type === 'label:update' ||
      lastEvent.type === 'contact:labels'
    ) {
      fetchContacts();
    }
  }, [lastEvent, fetchContacts]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
        Error al cargar contactos: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ContactsFilters filters={filters} onChange={setFilters} />

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Table header */}
        <div className="hidden border-b border-zinc-800 px-4 py-3 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] sm:gap-4">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Nombre
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Etiquetas
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Ultimo mensaje
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Ultima respuesta
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Seguimiento
          </span>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="divide-y divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-4 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] sm:gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
                </div>
                <div className="hidden sm:block">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
                </div>
                <div className="hidden sm:block">
                  <div className="h-4 w-14 animate-pulse rounded bg-zinc-800" />
                </div>
                <div className="hidden sm:block">
                  <div className="h-4 w-14 animate-pulse rounded bg-zinc-800" />
                </div>
                <div className="hidden sm:block">
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <EmptyIcon />
            </div>
            <p className="text-sm font-medium text-zinc-300">
              No hay contactos
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Conecta WhatsApp para importar tus conversaciones.
            </p>
            <Link
              href="/settings"
              className="mt-4 rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-all active:scale-[0.97] hover:bg-cyan-500/20"
            >
              Ir a Ajustes
            </Link>
          </div>
        )}

        {/* Contact rows */}
        {!loading && contacts.length > 0 && (
          <div className="divide-y divide-zinc-800">
            {contacts.map((contact) => {
              const inactive = isInactive(contact);

              return (
                <Link
                  key={contact.jid}
                  href={`/contacts/${encodeURIComponent(contact.jid)}`}
                  className="group block px-4 py-3.5 min-h-[48px] transition-colors hover:bg-zinc-800/50 active:bg-zinc-800/70 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] sm:items-center sm:gap-4"
                >
                  {/* Name + phone */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-zinc-50">
                        {contact.name || 'Desconocido'}
                      </p>
                      {inactive && (
                        <span
                          title="Inactivo — sin respuesta en 7+ dias"
                          className="flex-shrink-0"
                        >
                          <WarningIcon />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {formatPhone(contact.phone)}
                    </p>
                  </div>

                  {/* Label badges */}
                  <div className="mt-2 sm:mt-0">
                    <LabelBadges labels={contact.labels} />
                  </div>

                  {/* Last message */}
                  <div className="hidden sm:block">
                    <span className="text-sm text-zinc-400">
                      {contact.last_message_at
                        ? timeAgo(contact.last_message_at)
                        : 'Nunca'}
                    </span>
                  </div>

                  {/* Last reply */}
                  <div className="hidden sm:block">
                    <span
                      className={`text-sm ${
                        inactive
                          ? 'text-amber-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {contact.last_reply_at
                        ? timeAgo(contact.last_reply_at)
                        : 'Nunca'}
                    </span>
                  </div>

                  {/* Follow-up */}
                  <div className="hidden sm:block">
                    <span className="text-sm text-zinc-400">
                      {contact.follow_up_date
                        ? formatDate(contact.follow_up_date)
                        : '—'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LabelBadges({ labels }: { labels: Label[] }) {
  if (!labels || labels.length === 0) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  const visible = labels.slice(0, 2);
  const remaining = labels.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((label) => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: getLabelColor(label.color) + '25',
            color: getLabelColor(label.color),
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: getLabelColor(label.color) }}
          />
          {label.name}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-zinc-500 bg-zinc-800">
          +{remaining}
        </span>
      )}
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-400"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function EmptyIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
