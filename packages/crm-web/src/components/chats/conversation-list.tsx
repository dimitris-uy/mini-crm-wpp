'use client';

import { timeAgo, formatPhone } from '@/lib/utils';
import type { Contact } from '@/lib/types';

interface ConversationListProps {
  contacts: Contact[];
  selectedJid: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectContact: (jid: string) => void;
  messagePreviews: Record<string, string>;
}

const AVATAR_COLORS = [
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-sky-600',
  'bg-lime-600',
  'bg-fuchsia-600',
];

function getAvatarColor(jid: string): string {
  let hash = 0;
  for (let i = 0; i < jid.length; i++) {
    hash = (hash * 31 + jid.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(contact: Contact): string {
  if (contact.name) return contact.name.charAt(0).toUpperCase();
  if (contact.phone) return contact.phone.charAt(0) === '+' ? contact.phone.charAt(1) : contact.phone.charAt(0);
  return '?';
}

function followUpDotColor(followUpDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fDate = new Date(followUpDate + 'T00:00:00');

  if (fDate < today) return 'bg-rose-400'; // overdue
  if (fDate.getTime() === today.getTime()) return 'bg-cyan-400'; // today
  return 'bg-zinc-500'; // future
}

export function ConversationList({
  contacts,
  selectedJid,
  searchQuery,
  onSearchChange,
  onSelectContact,
  messagePreviews,
}: ConversationListProps) {
  // Client-side filtering
  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Search bar */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversacion..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
            No hay conversaciones
          </div>
        ) : (
          filtered.map((contact) => {
            const isSelected = contact.jid === selectedJid;
            const preview = messagePreviews[contact.jid];
            const displayName = contact.name || formatPhone(contact.phone);

            return (
              <button
                key={contact.jid}
                type="button"
                onClick={() => onSelectContact(contact.jid)}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                    : 'border-l-2 border-l-transparent hover:bg-zinc-800/50'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${getAvatarColor(contact.jid)}`}
                >
                  {getInitial(contact)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {displayName}
                    </span>
                    {contact.last_message_at && (
                      <span className="shrink-0 text-xs text-zinc-500">
                        {timeAgo(contact.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="truncate text-xs text-zinc-500 flex-1">
                      {preview || (contact.status === 'client' ? 'Cliente' : 'Prospecto')}
                    </p>
                    {contact.follow_up_date && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${followUpDotColor(contact.follow_up_date)}`}
                        title={`Seguimiento: ${contact.follow_up_date}`}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
