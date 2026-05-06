'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ContactHeader } from '@/components/contact/contact-header';
import { ContactSidebar } from '@/components/contact/contact-sidebar';
import { ChatMessages } from '@/components/contact/chat-messages';
import { MessageComposer } from '@/components/contact/message-composer';
import type { Contact, Message } from '@/lib/types';

interface ContactDetailShellProps {
  jid: string;
}

export function ContactDetailShell({ jid }: ContactDetailShellProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(null);

  useEffect(() => {
    apiFetch<Contact>(`/contacts/${encodeURIComponent(jid)}`)
      .then(setContact)
      .catch((err) => setError(err.message));
  }, [jid]);

  function handleContactUpdate(updated: Partial<Contact>) {
    setContact((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-6 py-4 text-sm text-rose-400">
          Error al cargar contacto: {error}
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="text-sm">Cargando contacto...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -mt-8 flex h-[calc(100vh-0px)] flex-col lg:h-[calc(100vh-0px)]">
      {/* Header */}
      <ContactHeader contact={contact} onContactUpdate={handleContactUpdate} />

      {/* Mobile sidebar toggle */}
      <div className="flex items-center justify-end border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
          {sidebarOpen ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
      </div>

      {/* Main body: chat + sidebar */}
      <div className="flex min-h-0 flex-1">
        {/* Chat column */}
        <div className="flex min-w-0 flex-1 flex-col lg:w-[70%]">
          <ChatMessages jid={jid} optimisticMessage={optimisticMessage} />
          <MessageComposer jid={jid} onOptimisticSend={setOptimisticMessage} />
        </div>

        {/* Sidebar — desktop: always visible; mobile: collapsible */}
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } w-full border-t border-zinc-800 bg-zinc-900/50 lg:block lg:w-[30%] lg:border-t-0 lg:border-l overflow-y-auto`}
        >
          <ContactSidebar contact={contact} onContactUpdate={handleContactUpdate} />
        </aside>
      </div>
    </div>
  );
}
