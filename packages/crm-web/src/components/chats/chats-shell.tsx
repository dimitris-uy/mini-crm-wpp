'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ConversationList } from '@/components/chats/conversation-list';
import { ChatPanel } from '@/components/chats/chat-panel';
import type { Contact, Message } from '@/lib/types';

export function ChatsShell() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(null);
  const [messagePreviews, setMessagePreviews] = useState<Record<string, string>>({});
  const { lastEvent } = useWebSocket();

  // Fetch all contacts on mount
  useEffect(() => {
    apiFetch<Contact[]>('/contacts')
      .then((data) => {
        setContacts(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // WebSocket: update list on new messages & contact updates
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'message:new') {
      const payload = lastEvent.data as { message: Message; contact: Contact };
      const { message, contact } = payload;

      // Update message preview
      setMessagePreviews((prev) => ({
        ...prev,
        [message.contact_jid]: message.content,
      }));

      // Move contact to top by updating last_message_at
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.jid === contact.jid);
        if (idx >= 0) {
          const updated = { ...prev[idx], last_message_at: message.timestamp };
          return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
        // New contact not in list yet — add it
        return [{ ...contact, last_message_at: message.timestamp }, ...prev];
      });
    }

    if (lastEvent.type === 'contact:update') {
      const payload = lastEvent.data as { contact: Contact };
      setContacts((prev) =>
        prev.map((c) => (c.jid === payload.contact.jid ? { ...c, ...payload.contact } : c)),
      );
    }
  }, [lastEvent]);

  // Sort contacts: last_message_at descending, nulls at bottom
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.last_message_at && b.last_message_at) return b.last_message_at - a.last_message_at;
    if (a.last_message_at && !b.last_message_at) return -1;
    if (!a.last_message_at && b.last_message_at) return 1;
    return 0;
  });

  const selectedContact = selectedJid
    ? contacts.find((c) => c.jid === selectedJid) ?? null
    : null;

  const handleContactUpdate = useCallback(
    (partial: Partial<Contact>) => {
      if (!selectedJid) return;
      setContacts((prev) =>
        prev.map((c) => (c.jid === selectedJid ? { ...c, ...partial } : c)),
      );
    },
    [selectedJid],
  );

  const handleBack = useCallback(() => {
    setSelectedJid(null);
    setOptimisticMessage(null);
  }, []);

  const handleSelectContact = useCallback((jid: string) => {
    setSelectedJid(jid);
    setOptimisticMessage(null);
  }, []);

  if (loading) {
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
          <span className="text-sm">Cargando conversaciones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-16 sm:-mx-6 sm:-mt-16 lg:-mx-8 lg:-mt-8 flex h-screen flex-col">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Left: Conversation list */}
        <div
          className={`${
            selectedJid ? 'hidden lg:flex' : 'flex'
          } w-full lg:w-80 xl:w-96 flex-col border-r border-zinc-800`}
        >
          <ConversationList
            contacts={sortedContacts}
            selectedJid={selectedJid}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectContact={handleSelectContact}
            messagePreviews={messagePreviews}
          />
        </div>

        {/* Right: Chat panel or empty state */}
        <div
          className={`${
            !selectedJid ? 'hidden lg:flex' : 'flex'
          } flex-1 min-w-0 flex-col`}
        >
          {selectedContact ? (
            <ChatPanel
              contact={selectedContact}
              onContactUpdate={handleContactUpdate}
              onBack={handleBack}
              optimisticMessage={optimisticMessage}
              onOptimisticSend={setOptimisticMessage}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-700"
                >
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                  <path d="M8 12h.01" />
                  <path d="M12 12h.01" />
                  <path d="M16 12h.01" />
                </svg>
                <p className="text-sm">Selecciona una conversacion</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
