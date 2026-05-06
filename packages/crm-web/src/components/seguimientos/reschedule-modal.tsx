'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Contact } from '@/lib/types';

interface RescheduleModalProps {
  contact: Contact;
  onClose: () => void;
  onSaved: (jid: string, newDate: string | null) => void;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function nextMonday(): string {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0=Sun
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilMonday);
  return toDateStr(d);
}

const QUICK_PICKS = [
  { label: 'Manana', fn: () => addDays(1) },
  { label: 'En 3 dias', fn: () => addDays(3) },
  { label: 'Proxima semana', fn: nextMonday },
  { label: 'En 2 semanas', fn: () => addDays(14) },
];

export function RescheduleModal({ contact, onClose, onSaved }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState(contact.follow_up_date || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSave() {
    if (!selectedDate) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/contacts/${encodeURIComponent(contact.jid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ follow_up_date: selectedDate }),
      });
      onSaved(contact.jid, selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/contacts/${encodeURIComponent(contact.jid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ follow_up_date: null }),
      });
      onSaved(contact.jid, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            Reprogramar seguimiento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Contact name */}
        <p className="mb-4 text-sm text-zinc-400">
          {contact.name || contact.phone || 'Desconocido'}
        </p>

        {/* Date input */}
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Fecha de seguimiento
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mb-4 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40 [color-scheme:dark]"
        />

        {/* Quick picks */}
        <div className="mb-5 flex flex-wrap gap-2">
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick.label}
              type="button"
              onClick={() => setSelectedDate(pick.fn())}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              {pick.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="text-sm text-rose-400 transition-colors hover:text-rose-300 disabled:opacity-50"
          >
            Quitar seguimiento
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedDate}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
