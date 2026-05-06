'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

export function HistorySyncStatus() {
  const { lastEvent } = useWebSocket();
  const [syncing, setSyncing] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [done, setDone] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'history:sync:progress': {
        const data = lastEvent.data as { processed: number };
        setSyncing(true);
        setDone(false);
        setProcessed(data.processed);
        break;
      }
      case 'history:sync:done':
        setSyncing(false);
        setDone(true);

        // Auto-hide after 5 seconds
        hideTimerRef.current = setTimeout(() => {
          setDone(false);
          setProcessed(0);
        }, 5_000);
        break;
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [lastEvent]);

  // Not visible unless syncing or just done
  if (!syncing && !done) return null;

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      {syncing && (
        <div className="flex items-center gap-3">
          <SyncSpinner />
          <div>
            <p className="text-sm font-medium text-zinc-200">
              Sincronizando mensajes...
            </p>
            <p className="text-xs text-zinc-500">
              {processed.toLocaleString()} procesados
            </p>
          </div>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-emerald-400">
            Sincronizacion completa!
          </p>
        </div>
      )}
    </div>
  );
}

function SyncSpinner() {
  return (
    <svg
      className="h-6 w-6 animate-spin text-cyan-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
