/**
 * WhatsApp Connection Manager
 *
 * Manages a single Baileys v7 socket connection with:
 * - QR/pairing code authentication
 * - Auto-reconnect on transient failures
 * - LID-to-phone JID translation
 * - Message normalization (text, media captions)
 * - History sync capture
 * - Outgoing message queue (flush on reconnect)
 *
 * Patterns extracted from NanoClaw (nanoclaw/src/channels/whatsapp.ts).
 */

import { EventEmitter } from 'events';
import fs from 'fs';

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  useMultiFileAuthState,
  type WASocket,
  type Contact as BaileysContact,
  type WAMessage,
  type proto,
} from '@whiskeysockets/baileys';
import { LabelAssociationType } from '@whiskeysockets/baileys/lib/Types/LabelAssociation.js';
import pino from 'pino';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState = 'disconnected' | 'connecting' | 'qr_pending' | 'connected';

export interface IncomingMessage {
  id: string;
  jid: string;          // normalized phone JID (not LID)
  sender: string;       // 'me' | phone JID
  pushName?: string;    // contact display name from WhatsApp
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  timestamp: number;    // epoch ms
  fromMe: boolean;
}

export interface RawHistoryMessage {
  id: string;
  jid: string;
  sender: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  timestamp: number;
  fromMe: boolean;
}

export interface RawHistoryContact {
  jid: string;
  name?: string;
  notify?: string;
  phoneNumber?: string;
}

export interface WhatsAppManagerEvents {
  qr: [data: string];
  connection: [state: ConnectionState, phone?: string];
  message: [msg: IncomingMessage];
  history: [data: { messages: RawHistoryMessage[]; contacts: RawHistoryContact[] }];
  'history:done': [];
  'label:edit': [label: { id: string; name: string; color: number; predefinedId?: string; deleted: boolean }];
  'label:association': [data: { chatId: string; labelId: string; type: 'add' | 'remove' }];
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
}).child({ module: 'whatsapp' });

// Baileys wants a pino-compatible logger at 'silent' or 'warn' to avoid noise
const baileysLogger = pino({ level: 'silent' });

// ---------------------------------------------------------------------------
// WhatsAppManager
// ---------------------------------------------------------------------------

export class WhatsAppManager extends EventEmitter<WhatsAppManagerEvents> {
  private sock: WASocket | null = null;
  private state: ConnectionState = 'disconnected';
  private phone: string | null = null;
  private authDir: string;

  // LID -> phone JID cache
  private lidToPhoneMap: Record<string, string> = {};

  // Outgoing queue (flushed on reconnect)
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;

  // History sync completion detection
  private historyTimeout: ReturnType<typeof setTimeout> | null = null;
  private historyDone = false;
  private static readonly HISTORY_DONE_DELAY_MS = 5_000;

  constructor(authDir: string) {
    super();
    this.authDir = authDir;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  getState(): ConnectionState {
    return this.state;
  }

  getPhone(): string | null {
    return this.phone;
  }

  /**
   * Initialize auth state, create socket, wire up event handlers.
   * Resolves once the first 'open' connection is established.
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectInternal(resolve).catch(reject);
    });
  }

  /**
   * Send a text message. Queues if currently disconnected.
   */
  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.sock || this.state !== 'connected') {
      this.outgoingQueue.push({ jid, text });
      logger.info(
        { jid, length: text.length, queueSize: this.outgoingQueue.length },
        'Disconnected — message queued',
      );
      return;
    }
    try {
      await this.sock.sendMessage(jid, { text });
      logger.info({ jid, length: text.length }, 'Message sent');
    } catch (err) {
      this.outgoingQueue.push({ jid, text });
      logger.warn(
        { jid, err, queueSize: this.outgoingQueue.length },
        'Send failed — message queued for retry',
      );
    }
  }

  /**
   * Clean shutdown: close socket, clear timers.
   */
  async disconnect(): Promise<void> {
    this.setState('disconnected');
    if (this.historyTimeout) {
      clearTimeout(this.historyTimeout);
      this.historyTimeout = null;
    }
    this.sock?.end(undefined);
    this.sock = null;
  }

  /**
   * Full logout: tell WhatsApp server to deauthenticate, clear auth files,
   * then reconnect fresh (will generate a new QR code).
   */
  async logout(): Promise<void> {
    if (this.historyTimeout) {
      clearTimeout(this.historyTimeout);
      this.historyTimeout = null;
    }

    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {
        // If logout RPC fails, just close the socket
        this.sock.end(undefined);
      }
      this.sock = null;
    }

    this.phone = null;
    this.historyDone = false;
    this.setState('disconnected');

    // Clear auth files so next connect generates a fresh QR
    try {
      fs.rmSync(this.authDir, { recursive: true, force: true });
    } catch { /* best-effort */ }

    // Reconnect — will emit a new QR since there are no auth files
    logger.info('Logged out — reconnecting for fresh QR');
    setTimeout(() => {
      this.connectInternal().catch((err) => {
        logger.error({ err }, 'Post-logout reconnect failed');
      });
    }, 1_000);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.emit('connection', next, this.phone ?? undefined);
  }

  /**
   * Core connection logic. Adapted from NanoClaw's WhatsAppChannel.connectInternal.
   */
  private async connectInternal(onFirstOpen?: () => void): Promise<void> {
    this.setState('connecting');

    // Ensure auth directory exists
    fs.mkdirSync(this.authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    // Fetch latest WA Web version; fall back gracefully
    const { version } = await fetchLatestWaWebVersion({}).catch((err) => {
      logger.warn({ err }, 'Failed to fetch WA Web version — using default');
      return { version: undefined };
    });

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      printQRInTerminal: false, // we emit QR for the API layer
      logger: baileysLogger,
      browser: Browsers.macOS('Chrome'),
    });
    this.sock = sock;

    // ----- connection.update -----
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.setState('qr_pending');
        this.emit('qr', qr);
        logger.info('QR code generated — awaiting scan');
      }

      if (connection === 'close') {
        this.setState('disconnected');
        this.phone = null;

        const reason = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;

        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        logger.info(
          { reason, shouldReconnect, queued: this.outgoingQueue.length },
          'Connection closed',
        );

        if (shouldReconnect) {
          logger.info('Reconnecting in 3s...');
          setTimeout(() => {
            this.connectInternal().catch((err) => {
              logger.error({ err }, 'Reconnect failed — retrying in 5s');
              setTimeout(() => {
                this.connectInternal().catch((err2) => {
                  logger.error({ err: err2 }, 'Second reconnect attempt failed');
                });
              }, 5_000);
            });
          }, 3_000);
        } else {
          logger.warn('Logged out — clearing auth state');
          // Remove auth files so next connect starts fresh
          try {
            fs.rmSync(this.authDir, { recursive: true, force: true });
          } catch { /* best-effort */ }
          this.emit('connection', 'disconnected');
        }
      } else if (connection === 'open') {
        this.setState('connected');

        // Extract own phone number
        if (sock.user) {
          this.phone = sock.user.id.split(':')[0];
          logger.info({ phone: this.phone }, 'Connected to WhatsApp');

          // Seed LID-to-phone map with own identity
          const lidUser = sock.user.lid?.split(':')[0];
          if (lidUser) {
            this.lidToPhoneMap[lidUser] = `${this.phone}@s.whatsapp.net`;
            logger.debug({ lidUser, phone: this.phone }, 'Self LID mapping set');
          }
        }

        this.emit('connection', 'connected', this.phone ?? undefined);

        // Announce availability for presence updates
        sock.sendPresenceUpdate('available').catch((err) => {
          logger.warn({ err }, 'Failed to send presence update');
        });

        // Flush queued outgoing messages
        this.flushOutgoingQueue().catch((err) => {
          logger.error({ err }, 'Failed to flush outgoing queue');
        });

        // Resolve the initial connect() promise
        if (onFirstOpen) {
          onFirstOpen();
          onFirstOpen = undefined;
        }
      }
    });

    // ----- creds.update -----
    sock.ev.on('creds.update', saveCreds);

    // ----- messages.upsert -----
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      logger.debug({ count: messages.length, type }, 'messages.upsert fired');
      for (const msg of messages) {
        logger.debug(
          { id: msg.key.id, jid: msg.key.remoteJid, fromMe: msg.key.fromMe, hasMessage: !!msg.message },
          'Processing raw message',
        );
        const normalized = await this.normalizeWAMessageAsync(msg);
        if (!normalized) {
          logger.debug({ id: msg.key.id, jid: msg.key.remoteJid }, 'Message filtered out by normalizeWAMessage');
          continue;
        }
        logger.info({ id: normalized.id, jid: normalized.jid, type: normalized.type, fromMe: normalized.fromMe }, 'Message normalized and emitting');
        this.emit('message', normalized);
      }
    });

    // ----- messaging-history.set -----
    sock.ev.on('messaging-history.set', (data) => {
      const { contacts, messages, lidPnMappings } = data;

      // Store any LID->PN mappings that arrive with history
      if (lidPnMappings) {
        for (const mapping of lidPnMappings) {
          const lidUser = mapping.lid.split('@')[0].split(':')[0];
          const pnJid = `${mapping.pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
          this.lidToPhoneMap[lidUser] = pnJid;
        }
        logger.debug({ count: lidPnMappings.length }, 'LID mappings from history stored');
      }

      // Normalize history messages
      const historyMessages: RawHistoryMessage[] = [];
      for (const waMsg of messages) {
        const norm = this.normalizeWAMessage(waMsg, true);
        if (norm) {
          historyMessages.push(norm);
        }
      }

      // Normalize history contacts
      const historyContacts: RawHistoryContact[] = contacts
        .filter((c): c is BaileysContact & { id: string } => !!c.id)
        .map((c) => ({
          jid: c.id,
          name: c.name ?? c.verifiedName ?? undefined,
          notify: c.notify ?? undefined,
          phoneNumber: c.phoneNumber ?? undefined,
        }));

      if (historyMessages.length > 0 || historyContacts.length > 0) {
        this.emit('history', { messages: historyMessages, contacts: historyContacts });
        logger.info(
          { messages: historyMessages.length, contacts: historyContacts.length },
          'History chunk received',
        );
      }

      // Reset the "done" timer — history arrives in chunks.
      // Skip if we already emitted history:done to avoid re-triggering sync UI.
      if (!this.historyDone) {
        this.resetHistoryDoneTimer();
      }
    });

    // ----- messaging-history.status -----
    sock.ev.on('messaging-history.status', (data) => {
      if (data.status === 'complete' && !this.historyDone) {
        logger.info({ syncType: data.syncType, explicit: data.explicit }, 'History sync complete');
        if (this.historyTimeout) {
          clearTimeout(this.historyTimeout);
          this.historyTimeout = null;
        }
        this.historyDone = true;
        this.emit('history:done');
      }
    });

    // ----- lid-mapping.update -----
    sock.ev.on('lid-mapping.update', (mapping) => {
      const lidUser = mapping.lid.split('@')[0].split(':')[0];
      const pnJid = `${mapping.pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
      this.lidToPhoneMap[lidUser] = pnJid;
      logger.debug({ lid: mapping.lid, pn: pnJid }, 'LID mapping updated');
    });

    // ----- labels.edit -----
    sock.ev.on('labels.edit', (label) => {
      this.emit('label:edit', {
        id: label.id,
        name: label.name,
        color: label.color,
        predefinedId: label.predefinedId,
        deleted: label.deleted,
      });
    });

    // ----- labels.association -----
    sock.ev.on('labels.association', ({ association, type }) => {
      if (association.type === LabelAssociationType.Chat) {
        this.emit('label:association', {
          chatId: association.chatId,
          labelId: association.labelId,
          type,
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Message normalization
  // -----------------------------------------------------------------------

  /**
   * Normalize a raw Baileys WAMessage into our IncomingMessage format.
   * Returns null for messages that should be skipped.
   *
   * @param allowGroups - when true (used for history), group messages are included
   */
  private normalizeWAMessage(
    msg: WAMessage,
    allowGroups = false,
  ): IncomingMessage | null {
    if (!msg.message) return null;

    // Unwrap container types (viewOnce, ephemeral, edited, etc.)
    const normalized = normalizeMessageContent(msg.message);
    if (!normalized) return null;

    const rawJid = msg.key.remoteJid;
    if (!rawJid || rawJid === 'status@broadcast') return null;

    // Skip group messages in real-time (CRM is 1:1 focused)
    // Allow them in history mode for completeness
    if (!allowGroups && rawJid.endsWith('@g.us')) return null;

    // Translate LID to phone JID
    const chatJid = this.translateJidSync(rawJid);

    // Determine message type and content
    const { type, content } = this.extractContent(normalized);

    const fromMe = msg.key.fromMe ?? false;
    const timestamp = Number(msg.messageTimestamp ?? 0) * 1000;

    // Determine sender
    let sender: string;
    if (fromMe) {
      sender = 'me';
    } else if (msg.key.participant) {
      // Group message — sender is the participant
      sender = this.translateJidSync(msg.key.participant);
    } else {
      sender = chatJid;
    }

    return {
      id: msg.key.id ?? `${timestamp}-${chatJid}`,
      jid: chatJid,
      sender,
      pushName: msg.pushName ?? undefined,
      content,
      type,
      timestamp,
      fromMe,
    };
  }

  /**
   * Async version of normalizeWAMessage that awaits LID translation.
   * Used for real-time messages where we need the correct phone JID.
   */
  private async normalizeWAMessageAsync(
    msg: WAMessage,
  ): Promise<IncomingMessage | null> {
    if (!msg.message) return null;

    const normalized = normalizeMessageContent(msg.message);
    if (!normalized) return null;

    const rawJid = msg.key.remoteJid;
    if (!rawJid || rawJid === 'status@broadcast') return null;
    if (rawJid.endsWith('@g.us')) return null;

    const chatJid = await this.translateJidAsync(rawJid);
    const { type, content } = this.extractContent(normalized);

    const fromMe = msg.key.fromMe ?? false;
    const timestamp = Number(msg.messageTimestamp ?? 0) * 1000;

    let sender: string;
    if (fromMe) {
      sender = 'me';
    } else if (msg.key.participant) {
      sender = await this.translateJidAsync(msg.key.participant);
    } else {
      sender = chatJid;
    }

    return {
      id: msg.key.id ?? `${timestamp}-${chatJid}`,
      jid: chatJid,
      sender,
      pushName: msg.pushName ?? undefined,
      content,
      type,
      timestamp,
      fromMe,
    };
  }

  /**
   * Extract content string and message type from normalized message content.
   */
  private extractContent(
    normalized: ReturnType<typeof normalizeMessageContent>,
  ): { type: IncomingMessage['type']; content: string } {
    if (!normalized) return { type: 'text', content: '' };

    // Text messages
    if (normalized.conversation) {
      return { type: 'text', content: normalized.conversation };
    }
    if (normalized.extendedTextMessage?.text) {
      return { type: 'text', content: normalized.extendedTextMessage.text };
    }

    // Media messages with captions
    if (normalized.imageMessage) {
      return { type: 'image', content: normalized.imageMessage.caption ?? '' };
    }
    if (normalized.videoMessage) {
      return { type: 'video', content: normalized.videoMessage.caption ?? '' };
    }
    if (normalized.audioMessage) {
      return { type: 'audio', content: '' };
    }
    if (normalized.documentMessage) {
      return {
        type: 'document',
        content: normalized.documentMessage.caption ?? normalized.documentMessage.fileName ?? '',
      };
    }

    // Fallback: protocol/reaction/unknown — empty text
    return { type: 'text', content: '' };
  }

  // -----------------------------------------------------------------------
  // LID translation
  // -----------------------------------------------------------------------

  /**
   * Synchronous LID-to-phone translation using the local cache.
   * Falls back to the original JID if no mapping exists.
   *
   * For the async path (signalRepository lookup), see translateJidAsync.
   */
  private translateJidSync(jid: string): string {
    if (!jid.endsWith('@lid')) return jid;
    const lidUser = jid.split('@')[0].split(':')[0];
    const cached = this.lidToPhoneMap[lidUser];
    if (cached) {
      logger.debug({ lid: jid, phone: cached }, 'LID translated (cache)');
      return cached;
    }
    // Fire async lookup in background — result will be cached for next time
    this.translateJidAsync(jid).catch(() => { /* swallow */ });
    return jid;
  }

  /**
   * Async LID-to-phone translation using Baileys' signal repository.
   * Extracted from NanoClaw's translateJid method.
   */
  private async translateJidAsync(jid: string): Promise<string> {
    if (!jid.endsWith('@lid')) return jid;
    const lidUser = jid.split('@')[0].split(':')[0];

    // Check cache first
    const cached = this.lidToPhoneMap[lidUser];
    if (cached) return cached;

    // Query signal repository
    try {
      const pn = await this.sock?.signalRepository?.lidMapping?.getPNForLID(jid);
      if (pn) {
        const phoneJid = `${pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
        this.lidToPhoneMap[lidUser] = phoneJid;
        logger.info({ lid: jid, phone: phoneJid }, 'LID translated (signalRepository)');
        return phoneJid;
      }
    } catch (err) {
      logger.debug({ err, jid }, 'LID resolution via signalRepository failed');
    }

    return jid;
  }

  // -----------------------------------------------------------------------
  // Outgoing queue
  // -----------------------------------------------------------------------

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info({ count: this.outgoingQueue.length }, 'Flushing outgoing queue');
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift()!;
        await this.sock!.sendMessage(item.jid, { text: item.text });
        logger.info({ jid: item.jid, length: item.text.length }, 'Queued message sent');
      }
    } catch (err) {
      logger.error({ err }, 'Error flushing outgoing queue');
    } finally {
      this.flushing = false;
    }
  }

  // -----------------------------------------------------------------------
  // History done timer
  // -----------------------------------------------------------------------

  /**
   * Reset the "history done" timer. If no new history chunks arrive within
   * HISTORY_DONE_DELAY_MS, we assume history sync is complete.
   * This is a fallback — the messaging-history.status event with status
   * 'complete' is the preferred signal.
   */
  private resetHistoryDoneTimer(): void {
    if (this.historyTimeout) {
      clearTimeout(this.historyTimeout);
    }
    this.historyTimeout = setTimeout(() => {
      this.historyTimeout = null;
      logger.info('History sync done (timeout — no more chunks)');
      this.historyDone = true;
      this.emit('history:done');
    }, WhatsAppManager.HISTORY_DONE_DELAY_MS);
  }
}
