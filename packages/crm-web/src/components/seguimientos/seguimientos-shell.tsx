'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Contact } from '@/lib/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SeguimientosFilters, type SeguimientoFilters } from './seguimientos-filters';
import { FollowUpListView } from './follow-up-list-view';
import { CalendarView } from './calendar-view';
import { RescheduleModal } from './reschedule-modal';

type ViewMode = 'list' | 'calendar';

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getEndOfWeek(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const end = new Date(now);
  end.setDate(end.getDate() + daysUntilSunday);
  return end.toISOString().slice(0, 10);
}

export function SeguimientosShell() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<SeguimientoFilters>({
    dateRange: 'all',
    status: 'all',
    search: '',
  });
  const [rescheduleTarget, setRescheduleTarget] = useState<Contact | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const { lastEvent } = useWebSocket();

  const fetchContacts = useCallback(() => {
    apiFetch<Contact[]>('/contacts')
      .then(setContacts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Re-fetch on contact:update events
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'contact:update') {
      fetchContacts();
    }
  }, [lastEvent, fetchContacts]);

  const filteredContacts = useMemo(() => {
    const today = getToday();
    const endOfWeek = getEndOfWeek();

    return contacts
      .filter((c) => c.follow_up_date !== null)
      .filter((c) => {
        const date = c.follow_up_date!;
        switch (filters.dateRange) {
          case 'overdue':
            return date < today;
          case 'today':
            return date === today;
          case 'week':
            return date >= today && date <= endOfWeek;
          case 'all':
          default:
            return true;
        }
      })
      .filter((c) => {
        if (filters.status === 'all') return true;
        return c.status === filters.status;
      })
      .filter((c) => {
        if (!filters.search) return true;
        const term = filters.search.toLowerCase();
        const name = (c.name || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(term) || phone.includes(term);
      });
  }, [contacts, filters]);

  function handleReschedule(contact: Contact) {
    setRescheduleTarget(contact);
  }

  function handleSaved(jid: string, newDate: string | null) {
    setContacts((prev) =>
      prev.map((c) =>
        c.jid === jid ? { ...c, follow_up_date: newDate } : c,
      ),
    );
    setRescheduleTarget(null);
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
        Error al cargar seguimientos: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Calendario
          </button>
        </div>

        <SeguimientosFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Active view */}
      {viewMode === 'list' ? (
        <FollowUpListView
          contacts={filteredContacts}
          loading={loading}
          onReschedule={handleReschedule}
        />
      ) : (
        <CalendarView
          contacts={filteredContacts}
          onReschedule={handleReschedule}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <RescheduleModal
          contact={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
