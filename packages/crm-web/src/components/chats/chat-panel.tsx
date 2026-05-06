'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatPhone } from '@/lib/utils';
import { ChatMessages } from '@/components/contact/chat-messages';
import { MessageComposer } from '@/components/contact/message-composer';
import { FollowUpPicker } from '@/components/chats/follow-up-picker';
import type { Contact, Message } from '@/lib/types';

interface ChatPanelProps {
  contact: Contact;
  onContactUpdate: (partial: Partial<Contact>) => void;
  onBack: () => void;
  optimisticMessage: Message | null;
  onOptimisticSend: (msg: Message) => void;
}

export function ChatPanel({
  contact,
  onContactUpdate,
  onBack,
  optimisticMessage,
  onOptimisticSend,
}: ChatPanelProps) {
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
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Back button (mobile only) */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center h-10 w-10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors lg:hidden cursor-pointer"
          aria-label="Volver"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Contact info */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-zinc-100">
            {contact.name || formatPhone(contact.phone)}
          </h2>
          {contact.name && (
            <p className="text-xs text-zinc-500">{formatPhone(contact.phone)}</p>
          )}
        </div>

        {/* Status badge */}
        <button
          type="button"
          onClick={toggleStatus}
          disabled={toggling}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer ${statusStyles} ${
            toggling ? 'opacity-60' : ''
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              contact.status === 'client' ? 'bg-emerald-400' : 'bg-cyan-400'
            }`}
          />
          {contact.status === 'client' ? 'Cliente' : 'Prospecto'}
        </button>

        {/* Follow-up picker */}
        <FollowUpPicker contact={contact} onContactUpdate={onContactUpdate} />

        {/* Link to full contact detail */}
        <Link
          href={`/contacts/${encodeURIComponent(contact.jid)}`}
          className="flex items-center justify-center h-9 w-9 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Ver detalle completo"
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
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </Link>
      </div>

      {/* Messages */}
      <ChatMessages jid={contact.jid} optimisticMessage={optimisticMessage} />

      {/* Composer */}
      <MessageComposer jid={contact.jid} onOptimisticSend={onOptimisticSend} />
    </div>
  );
}
