'use client';

import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { Message } from '@/lib/types';

interface MessageComposerProps {
  jid: string;
  onOptimisticSend: (message: Message) => void;
}

export function MessageComposer({ jid, onOptimisticSend }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Optimistic message
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      contact_jid: jid,
      sender: 'me',
      content: trimmed,
      type: 'text',
      timestamp: Date.now(),
    };

    onOptimisticSend(optimistic);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setSending(true);
    try {
      await apiFetch('/messages/send', {
        method: 'POST',
        body: JSON.stringify({ jid, text: trimmed }),
      });
    } catch {
      // Message was already added optimistically. In a production app,
      // we'd mark it as failed. For now, silently fail.
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const canSend = text.trim().length > 0 && !sending;

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-cyan-500/50"
        />

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            canSend
              ? 'bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
          title="Send message"
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
            <path d="m22 2-7 20-4-9-9-4z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}
