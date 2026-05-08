/**
 * WebSocket Broadcast Server
 *
 * Wires MessageProcessor and WhatsAppManager events to connected
 * WebSocket clients for real-time dashboard updates.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { MessageProcessor } from './processor.js';
import type { WhatsAppManager } from './whatsapp.js';

export function createWSServer(
  port: number,
  processor: MessageProcessor,
  wa: WhatsAppManager,
): WebSocketServer {
  const wss = new WebSocketServer({ port });

  function broadcast(type: string, data: unknown): void {
    const payload = JSON.stringify({ type, data });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // Processor events
  processor.on('message:new', (data) => {
    broadcast('message:new', data);
  });

  processor.on('contact:update', (data) => {
    broadcast('contact:update', data);
  });

  processor.on('history:sync:progress', (data) => {
    broadcast('history:sync:progress', data);
  });

  processor.on('history:sync:done', () => {
    broadcast('history:sync:done', {});
  });

  processor.on('label:update', (data) => {
    broadcast('label:update', data);
  });

  processor.on('contact:labels', (data) => {
    broadcast('contact:labels', data);
  });

  // WhatsApp events
  wa.on('qr', (qr) => {
    broadcast('qr', { data: qr });
  });

  wa.on('connection', (state, phone) => {
    broadcast('connection:update', {
      connected: state === 'connected',
      phone: phone ?? null,
    });
  });

  return wss;
}
