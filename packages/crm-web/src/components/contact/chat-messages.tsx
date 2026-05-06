'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Message } from '@/lib/types';

interface ChatMessagesProps {
  jid: string;
  /** Externally pushed message (from composer optimistic UI). */
  optimisticMessage: Message | null;
}

const LIMIT = 50;

const mediaLabels: Record<string, string> = {
  image: '[Imagen]',
  audio: '[Audio]',
  video: '[Video]',
  document: '[Documento]',
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function dateLabelFor(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';

  return d.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
}

function needsDateSeparator(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return true;
  const prevDate = new Date(prev.timestamp).toDateString();
  const currDate = new Date(curr.timestamp).toDateString();
  return prevDate !== currDate;
}

export function ChatMessages({ jid, optimisticMessage }: ChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const { lastEvent } = useWebSocket();

  // Track whether user has scrolled up
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom < 80;
  }, []);

  // Initial message load
  useEffect(() => {
    setLoading(true);
    apiFetch<Message[]>(
      `/contacts/${encodeURIComponent(jid)}/messages?limit=${LIMIT}`,
    )
      .then((data) => {
        setMessages(data);
        setHasMore(data.length >= LIMIT);
        setLoading(false);
        // Scroll to bottom after render
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'instant' });
        });
      })
      .catch(() => {
        setLoading(false);
      });
  }, [jid]);

  // Load older messages on scroll to top
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    const el = containerRef.current;
    if (!el || el.scrollTop > 50) return;

    setLoadingMore(true);
    const oldestTs = messages[0].timestamp;
    const prevScrollHeight = el.scrollHeight;

    try {
      const older = await apiFetch<Message[]>(
        `/contacts/${encodeURIComponent(jid)}/messages?limit=${LIMIT}&before=${oldestTs}`,
      );

      if (older.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => [...older, ...prev]);
        // Preserve scroll position
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
        setHasMore(older.length >= LIMIT);
      }
    } catch {
      // Silently fail; user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  }, [jid, loadingMore, hasMore, messages]);

  // Attach scroll handler for infinite scroll up
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onScroll() {
      handleScroll();
      if (el!.scrollTop < 50) {
        loadOlder();
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [handleScroll, loadOlder]);

  // WebSocket: listen for new messages
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== 'message:new') return;

    const payload = lastEvent.data as { message: Message; contact: unknown };
    const incoming = payload.message;
    if (!incoming || incoming.contact_jid !== jid) return;

    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;
      // Replace optimistic message if this is our own message echoed back
      if (incoming.sender === 'me') {
        const optimisticIdx = prev.findIndex((m) => m.id.startsWith('optimistic-') && m.sender === 'me');
        if (optimisticIdx >= 0) {
          const updated = [...prev];
          updated[optimisticIdx] = incoming;
          return updated;
        }
      }
      return [...prev, incoming];
    });

    // Auto-scroll if near bottom
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [lastEvent, jid]);

  // Optimistic message from composer
  useEffect(() => {
    if (!optimisticMessage) return;

    setMessages((prev) => {
      if (prev.some((m) => m.id === optimisticMessage.id)) return prev;
      return [...prev, optimisticMessage];
    });

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [optimisticMessage]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <svg
            className="h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
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
          <span className="text-sm">Cargando mensajes...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-600"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-sm">No hay mensajes. Envia el primero!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
    >
      {loadingMore && (
        <div className="mb-3 flex justify-center">
          <span className="text-xs text-zinc-500">Cargando mensajes anteriores...</span>
        </div>
      )}

      {messages.map((msg, i) => {
        const showDate = needsDateSeparator(messages[i - 1], msg);
        const isOutbound = msg.sender === 'me';

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-4 flex items-center justify-center">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-[11px] font-medium text-zinc-400">
                  {dateLabelFor(msg.timestamp)}
                </span>
              </div>
            )}

            <div
              className={`mb-2 flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 ${
                  isOutbound
                    ? 'rounded-br-md bg-cyan-700 text-white'
                    : 'rounded-bl-md bg-zinc-800 text-zinc-100'
                }`}
              >
                {msg.type === 'text' ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {msg.content}
                  </p>
                ) : (
                  <p className="text-sm italic text-zinc-300">
                    {mediaLabels[msg.type] || `[${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}]`}
                  </p>
                )}
                <p
                  className={`mt-1 text-[10px] ${
                    isOutbound ? 'text-cyan-200/60' : 'text-zinc-500'
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
