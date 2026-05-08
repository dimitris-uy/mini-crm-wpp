/**
 * Message Processor
 *
 * Bridges WhatsAppManager events to the database layer.
 * Emits its own events for the WebSocket layer to broadcast to clients.
 */

import { EventEmitter } from 'events';
import type Database from 'better-sqlite3';
import type { WhatsAppManager, IncomingMessage, RawHistoryMessage, RawHistoryContact } from './whatsapp.js';
import type { Contact, Label, Message } from './types.js';
import {
  upsertContact,
  getContact,
  insertMessage,
  bulkInsertMessages,
  upsertLabel,
  deleteLabel,
  getLabels,
  setContactLabel,
  removeContactLabel,
  getContactLabels,
} from './db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessorEvents {
  'message:new': [data: { message: Message; contact: Contact }];
  'contact:update': [data: { contact: Contact }];
  'history:sync:progress': [data: { processed: number }];
  'history:sync:done': [];
  'label:update': [data: { labels: Label[] }];
  'contact:labels': [data: { jid: string; labels: Label[] }];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract phone number from a WhatsApp JID.
 * `5491123456789@s.whatsapp.net` → `+5491123456789`
 */
export function phoneFromJid(jid: string): string {
  const user = jid.split('@')[0];
  return `+${user}`;
}

// ---------------------------------------------------------------------------
// MessageProcessor
// ---------------------------------------------------------------------------

export class MessageProcessor extends EventEmitter<ProcessorEvents> {
  private db: Database.Database;
  private wa: WhatsAppManager;
  private historySyncDone = false;

  constructor(db: Database.Database, wa: WhatsAppManager) {
    super();
    this.db = db;
    this.wa = wa;

    this.wireEvents();
  }

  private wireEvents(): void {
    this.wa.on('message', (msg) => this.handleMessage(msg));
    this.wa.on('history', (data) => this.handleHistory(data));
    this.wa.on('history:done', () => this.handleHistoryDone());
    this.wa.on('label:edit', (label) => this.handleLabelEdit(label));
    this.wa.on('label:association', (data) => this.handleLabelAssociation(data));
  }

  // -----------------------------------------------------------------------
  // Real-time message handler
  // -----------------------------------------------------------------------

  private handleMessage(msg: IncomingMessage): void {
    const phone = phoneFromJid(msg.jid);

    // Upsert contact — only set name if pushName is provided and contact
    // doesn't already have a name. Never pass status so existing status is
    // preserved (upsertContact defaults to 'prospect' only on creation).
    const existingContact = getContact(this.db, msg.jid);
    const shouldSetName = msg.pushName && (!existingContact || !existingContact.name);

    upsertContact(this.db, {
      jid: msg.jid,
      ...(shouldSetName ? { name: msg.pushName } : {}),
      phone,
    });

    // Insert the message — this also updates last_message_at and
    // last_reply_at (when sender !== 'me') via db.insertMessage internals.
    insertMessage(this.db, {
      id: msg.id,
      contact_jid: msg.jid,
      sender: msg.fromMe ? 'me' : msg.jid,
      content: msg.content,
      type: msg.type,
      timestamp: msg.timestamp,
    });

    const contact = getContact(this.db, msg.jid)!;
    const message: Message = {
      id: msg.id,
      contact_jid: msg.jid,
      sender: msg.fromMe ? 'me' : msg.jid,
      content: msg.content,
      type: msg.type,
      timestamp: msg.timestamp,
    };

    this.emit('message:new', { message, contact });
    this.emit('contact:update', { contact });
  }

  // -----------------------------------------------------------------------
  // History sync handler
  // -----------------------------------------------------------------------

  private handleHistory(data: { messages: RawHistoryMessage[]; contacts: RawHistoryContact[] }): void {
    // 1. Process contacts — only set name if the contact has none yet
    for (const c of data.contacts) {
      const candidateName = c.name ?? c.notify ?? undefined;
      const phone = c.phoneNumber ?? phoneFromJid(c.jid);
      const existing = getContact(this.db, c.jid);
      const shouldSetName = candidateName && (!existing || !existing.name);

      upsertContact(this.db, {
        jid: c.jid,
        ...(shouldSetName ? { name: candidateName } : {}),
        phone,
      });
    }

    // 2. Bulk insert messages
    const dbMessages = data.messages.map((m) => ({
      id: m.id,
      contact_jid: m.jid,
      sender: m.fromMe ? 'me' : m.jid,
      content: m.content,
      type: m.type as 'text' | 'image' | 'audio' | 'video' | 'document',
      timestamp: m.timestamp,
    }));

    bulkInsertMessages(this.db, dbMessages);

    // 3. Update contact timestamps from their messages.
    //    bulkInsertMessages does NOT touch contact timestamps, so we compute
    //    them from the batch and update manually.
    const contactTimestamps = new Map<string, { lastMessage: number; lastReply: number }>();

    for (const m of data.messages) {
      const entry = contactTimestamps.get(m.jid) ?? { lastMessage: 0, lastReply: 0 };

      if (m.timestamp > entry.lastMessage) {
        entry.lastMessage = m.timestamp;
      }
      if (!m.fromMe && m.timestamp > entry.lastReply) {
        entry.lastReply = m.timestamp;
      }

      contactTimestamps.set(m.jid, entry);
    }

    const updateStmt = this.db.prepare(
      `UPDATE contacts
       SET last_message_at = MAX(COALESCE(last_message_at, 0), ?),
           last_reply_at   = MAX(COALESCE(last_reply_at, 0), ?),
           updated_at       = ?
       WHERE jid = ?`,
    );

    const now = Date.now();
    for (const [jid, ts] of contactTimestamps) {
      updateStmt.run(ts.lastMessage, ts.lastReply, now, jid);
    }

    // 4. Emit progress (skip if sync already marked done to avoid re-triggering UI)
    if (!this.historySyncDone) {
      this.emit('history:sync:progress', { processed: data.messages.length });
    }
  }

  // -----------------------------------------------------------------------
  // History done handler
  // -----------------------------------------------------------------------

  private handleHistoryDone(): void {
    this.historySyncDone = true;
    this.emit('history:sync:done');
  }

  // -----------------------------------------------------------------------
  // Label handlers
  // -----------------------------------------------------------------------

  private handleLabelEdit(label: { id: string; name: string; color: number; predefinedId?: string; deleted: boolean }): void {
    if (label.deleted) {
      deleteLabel(this.db, label.id);
    } else {
      upsertLabel(this.db, {
        id: label.id,
        name: label.name,
        color: label.color,
        predefined_id: label.predefinedId,
      });
    }
    const labels = getLabels(this.db);
    this.emit('label:update', { labels });
  }

  private handleLabelAssociation(data: { chatId: string; labelId: string; type: 'add' | 'remove' }): void {
    if (data.type === 'add') {
      setContactLabel(this.db, data.chatId, data.labelId);
    } else {
      removeContactLabel(this.db, data.chatId, data.labelId);
    }
    const labels = getContactLabels(this.db, data.chatId);
    this.emit('contact:labels', { jid: data.chatId, labels });
  }
}
