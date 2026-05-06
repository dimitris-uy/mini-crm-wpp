'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Contact } from '@/lib/types';

interface FollowUpPickerProps {
  contact: Contact;
  onContactUpdate: (partial: Partial<Contact>) => void;
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function FollowUpPicker({ contact, onContactUpdate }: FollowUpPickerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function saveDate(date: string | null) {
    setSaving(true);
    onContactUpdate({ follow_up_date: date });

    try {
      await apiFetch(`/contacts/${encodeURIComponent(contact.jid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ follow_up_date: date }),
      });
    } catch {
      onContactUpdate({ follow_up_date: contact.follow_up_date });
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  const quickOptions = [
    { label: 'Manana', days: 1 },
    { label: 'En 3 dias', days: 3 },
    { label: 'En 1 semana', days: 7 },
    { label: 'En 2 semanas', days: 14 },
  ];

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-9 rounded-lg px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
        title="Seguimiento"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
        {contact.follow_up_date && (
          <span className="text-xs font-medium text-cyan-400">
            {formatDate(contact.follow_up_date)}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-zinc-800 bg-zinc-900 p-3 shadow-xl">
          {/* Date input */}
          <input
            type="date"
            value={contact.follow_up_date ?? ''}
            onChange={(e) => saveDate(e.target.value || null)}
            disabled={saving}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-60 [color-scheme:dark]"
          />

          {/* Quick select buttons */}
          <div className="mt-2 flex flex-col gap-1">
            {quickOptions.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => saveDate(addDays(opt.days))}
                disabled={saving}
                className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear button */}
          {contact.follow_up_date && (
            <button
              type="button"
              onClick={() => saveDate(null)}
              disabled={saving}
              className="mt-2 w-full rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-100 transition-all disabled:opacity-60 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
