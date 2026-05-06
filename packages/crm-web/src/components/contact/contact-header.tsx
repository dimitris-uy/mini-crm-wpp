'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatPhone } from '@/lib/utils';
import type { Contact } from '@/lib/types';

interface ContactHeaderProps {
  contact: Contact;
  onContactUpdate: (updated: Partial<Contact>) => void;
}

export function ContactHeader({ contact, onContactUpdate }: ContactHeaderProps) {
  const [toggling, setToggling] = useState(false);

  async function toggleStatus() {
    const newStatus = contact.status === 'prospect' ? 'client' : 'prospect';
    setToggling(true);
    onContactUpdate({ status: newStatus });

    try {
      await apiFetch(`/contacts/${encodeURIComponent(contact.jid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
      onContactUpdate({ status: contact.status });
    } finally {
      setToggling(false);
    }
  }

  const statusStyles =
    contact.status === 'client'
      ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
      : 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25';

  return (
    <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 sm:px-6">
      <Link
        href="/contacts"
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
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
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span className="hidden sm:inline">Contacts</span>
      </Link>

      <div className="h-5 w-px bg-zinc-800 shrink-0" />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-zinc-100 sm:text-lg">
          {contact.name || formatPhone(contact.phone)}
        </h1>
        {contact.name && (
          <p className="text-xs text-zinc-500">{formatPhone(contact.phone)}</p>
        )}
      </div>

      <button
        type="button"
        onClick={toggleStatus}
        disabled={toggling}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${statusStyles} ${
          toggling ? 'opacity-60' : ''
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            contact.status === 'client' ? 'bg-emerald-400' : 'bg-cyan-400'
          }`}
        />
        {contact.status === 'client' ? 'Client' : 'Prospect'}
      </button>
    </div>
  );
}
