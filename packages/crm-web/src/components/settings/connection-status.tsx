'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/api';

type ConnectionState = 'connected' | 'disconnected' | 'connecting';

interface StatusResponse {
  connected: boolean;
  phone: string | null;
}

export function ConnectionStatus() {
  const { lastEvent } = useWebSocket();
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [phone, setPhone] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Fetch initial status on mount
  useEffect(() => {
    apiFetch<StatusResponse>('/status')
      .then((res) => {
        setState(res.connected ? 'connected' : 'disconnected');
        if (res.phone) setPhone(res.phone);
      })
      .catch(() => {
        setState('disconnected');
      });
  }, []);

  // React to WebSocket events
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'connection:update': {
        const data = lastEvent.data as { connected: boolean; phone?: string };
        setState(data.connected ? 'connected' : 'disconnected');
        if (data.phone) setPhone(data.phone);
        break;
      }
      case 'qr':
        // QR received means we're in connecting state
        setState('connecting');
        break;
      case 'connected': {
        const data = lastEvent.data as { phone?: string };
        setState('connected');
        if (data?.phone) setPhone(data.phone);
        break;
      }
      case 'disconnected':
        setState('disconnected');
        setPhone(null);
        break;
    }
  }, [lastEvent]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await apiFetch('/disconnect', { method: 'POST' });
      setState('disconnected');
      setPhone(null);
    } catch {
      // Will be updated via WebSocket anyway
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <span
          className={`relative flex h-3 w-3 ${
            state === 'connecting' ? '' : ''
          }`}
        >
          {state === 'connecting' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${
              state === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : state === 'connecting'
                  ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                  : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
            }`}
          />
        </span>

        {/* Status text */}
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {state === 'connected' && 'Conectado'}
            {state === 'connecting' && 'Conectando...'}
            {state === 'disconnected' && 'Desconectado'}
          </p>
          {state === 'connected' && phone && (
            <p className="text-xs text-zinc-400">{phone}</p>
          )}
          {state === 'disconnected' && (
            <p className="text-xs text-zinc-500">
              Escanea el codigo QR para conectar
            </p>
          )}
        </div>
      </div>

      {/* Disconnect button */}
      {state === 'connected' && (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all duration-150 active:scale-[0.97] hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disconnecting ? 'Desconectando...' : 'Desconectar'}
        </button>
      )}
    </div>
  );
}
