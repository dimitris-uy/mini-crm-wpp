'use client';

import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { formatPhone, timeAgo } from '@/lib/utils';
import type { Contact } from '@/lib/types';

interface ContactSidebarProps {
  contact: Contact;
  onContactUpdate: (updated: Partial<Contact>) => void;
}

export function ContactSidebar({ contact, onContactUpdate }: ContactSidebarProps) {
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  async function saveNotes() {
    const notes = notesRef.current?.value ?? '';
    if (notes === contact.notes) return;

    setSavingNotes(true);
    onContactUpdate({ notes });

    try {
      await apiFetch(`/contacts/${encodeURIComponent(contact.jid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
    } catch {
      // Revert on error
      if (notesRef.current) notesRef.current.value = contact.notes;
      onContactUpdate({ notes: contact.notes });
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveFollowUpDate(date: string | null) {
    setSavingDate(true);
    onContactUpdate({ follow_up_date: date });

    try {
      await apiFetch(`/contacts/${encodeURIComponent(contact.jid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ follow_up_date: date }),
      });
    } catch {
      onContactUpdate({ follow_up_date: contact.follow_up_date });
    } finally {
      setSavingDate(false);
    }
  }

  const createdDate = new Date(contact.created_at).toLocaleDateString('es-AR', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-4 p-3 sm:gap-5 sm:p-4 lg:p-5">
      {/* Follow-up date */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Seguimiento
        </label>
        <p className="mb-2 text-xs text-zinc-600">Fecha de seguimiento</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={contact.follow_up_date ?? ''}
            onChange={(e) => saveFollowUpDate(e.target.value || null)}
            disabled={savingDate}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-60 [color-scheme:dark]"
          />
          {contact.follow_up_date && (
            <button
              type="button"
              onClick={() => saveFollowUpDate(null)}
              disabled={savingDate}
              className="rounded-lg border border-zinc-800 px-2.5 py-2 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-100 transition-all duration-150 active:scale-[0.97]"
              title="Limpiar seguimiento"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Notas
          {savingNotes && (
            <span className="text-[10px] normal-case tracking-normal text-cyan-400">
              guardando...
            </span>
          )}
        </label>
        <textarea
          ref={notesRef}
          defaultValue={contact.notes}
          onBlur={saveNotes}
          placeholder="Agregar notas sobre este contacto..."
          rows={5}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
        />
      </div>

      {/* Contact info */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Informacion
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Telefono</dt>
            <dd className="text-zinc-300">{formatPhone(contact.phone)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Desde</dt>
            <dd className="text-zinc-300">{createdDate}</dd>
          </div>
          {contact.last_reply_at && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Ultima respuesta</dt>
              <dd className="text-zinc-300">{timeAgo(contact.last_reply_at)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
