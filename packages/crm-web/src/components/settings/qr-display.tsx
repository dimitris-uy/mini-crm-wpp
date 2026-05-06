'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/api';

interface QrResponse {
  qr: string | null;
}

export function QrDisplay() {
  const { lastEvent } = useWebSocket();
  const [qrData, setQrData] = useState<string | null>(null);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch QR from API
  const fetchQr = useCallback(() => {
    apiFetch<QrResponse>('/qr')
      .then((res) => {
        if (res.qr) setQrData(res.qr);
      })
      .catch(() => {
        // Silently fail — WebSocket will provide updates
      });
  }, []);

  // Check initial connection status + poll for QR on mount
  useEffect(() => {
    apiFetch<{ connected: boolean }>('/status')
      .then((res) => {
        if (res.connected) {
          setIsConnected(true);
        } else {
          fetchQr();
          pollTimerRef.current = setInterval(fetchQr, 15_000);
        }
      })
      .catch(() => {
        fetchQr();
        pollTimerRef.current = setInterval(fetchQr, 15_000);
      });

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchQr]);

  // Listen to WebSocket events
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'qr': {
        const data = lastEvent.data as { data: string };
        setQrData(data.data);
        setIsConnected(false);
        setShowSuccess(false);
        break;
      }
      case 'connected':
        setIsConnected(true);
        setShowSuccess(true);
        setQrData(null);
        // Stop polling
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        break;
      case 'connection:update': {
        const data = lastEvent.data as { connected: boolean };
        if (data.connected) {
          setIsConnected(true);
          setShowSuccess(true);
          setQrData(null);
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        } else {
          setIsConnected(false);
          setShowSuccess(false);
          if (!pollTimerRef.current) {
            fetchQr();
            pollTimerRef.current = setInterval(fetchQr, 15_000);
          }
        }
        break;
      }
      case 'disconnected':
        setIsConnected(false);
        setShowSuccess(false);
        // Resume polling
        if (!pollTimerRef.current) {
          fetchQr();
          pollTimerRef.current = setInterval(fetchQr, 15_000);
        }
        break;
    }
  }, [lastEvent, fetchQr]);

  // Render QR code as SVG whenever qrData changes
  useEffect(() => {
    if (!qrData) {
      setSvgHtml(null);
      return;
    }

    QRCode.toString(qrData, {
      type: 'svg',
      margin: 2,
      width: 280,
      color: {
        dark: '#18181b',  // zinc-900
        light: '#ffffff',
      },
    })
      .then((svg) => setSvgHtml(svg))
      .catch(() => setSvgHtml(null));
  }, [qrData]);

  // Connected — show success
  if (isConnected || showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
          <CheckIcon />
        </div>
        <p className="mt-4 text-lg font-medium text-emerald-400">
          WhatsApp Conectado
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Tu sesion esta activa y recibiendo mensajes
        </p>
      </div>
    );
  }

  // No QR yet — waiting state
  if (!svgHtml) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-14 w-14 items-center justify-center">
          <LoadingSpinner />
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Esperando codigo QR...
        </p>
      </div>
    );
  }

  // QR available — render it
  return (
    <div className="flex flex-col items-center">
      {/* White background container for QR code contrast */}
      <div className="rounded-2xl bg-white p-4 shadow-lg shadow-black/20">
        <div
          dangerouslySetInnerHTML={{ __html: svgHtml }}
          className="[&>svg]:block [&>svg]:h-[280px] [&>svg]:w-[280px]"
        />
      </div>
      <p className="mt-5 text-sm font-medium text-zinc-300">
        Escanea con WhatsApp
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Abri WhatsApp &rarr; Ajustes &rarr; Dispositivos vinculados &rarr;
        Vincular dispositivo
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-400"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-10 w-10 animate-spin text-cyan-400"
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
