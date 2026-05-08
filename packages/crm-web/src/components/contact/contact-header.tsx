'use client';

import Link from 'next/link';
import { formatPhone } from '@/lib/utils';
import { getLabelColor } from '@/lib/label-colors';
import type { Contact } from '@/lib/types';

interface ContactHeaderProps {
  contact: Contact;
  onContactUpdate: (updated: Partial<Contact>) => void;
}

export function ContactHeader({ contact }: ContactHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4 border-b border-zinc-800 bg-zinc-900 px-3 py-2.5 sm:px-6 sm:py-3">
      <Link
        href="/contacts"
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors duration-150 shrink-0"
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
        <span className="hidden sm:inline">Contactos</span>
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

      {/* Labels */}
      <div className="flex flex-wrap gap-1.5">
        {contact.labels && contact.labels.length > 0 ? (
          contact.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white/90"
              style={{ backgroundColor: getLabelColor(label.color) + '30', color: getLabelColor(label.color) }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getLabelColor(label.color) }}
              />
              {label.name}
            </span>
          ))
        ) : (
          <span className="text-xs text-zinc-500">Sin etiquetas</span>
        )}
      </div>
    </div>
  );
}
