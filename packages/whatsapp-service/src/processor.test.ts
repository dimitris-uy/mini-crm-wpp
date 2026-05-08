import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  initDatabase,
  getContact,
  getMessages,
  upsertContact,
  updateContact,
  upsertLabel,
  setContactLabel,
  getLabels,
  getContactLabels,
} from './db.js';
import { MessageProcessor, phoneFromJid } from './processor.js';
import type { WhatsAppManager, WhatsAppManagerEvents } from './whatsapp.js';
import type Database from 'better-sqlite3';
import type { Contact, Label, Message } from './types.js';

// ---------------------------------------------------------------------------
// Mock WhatsAppManager — just an EventEmitter with the right type signature
// ---------------------------------------------------------------------------

function createMockWA(): WhatsAppManager {
  return new EventEmitter() as unknown as WhatsAppManager;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let db: Database.Database;
let wa: WhatsAppManager;
let processor: MessageProcessor;

beforeEach(() => {
  db = initDatabase(':memory:');
  wa = createMockWA();
  processor = new MessageProcessor(db, wa);
});

describe('phoneFromJid', () => {
  it('extracts phone with + prefix from standard JID', () => {
    expect(phoneFromJid('5491123456789@s.whatsapp.net')).toBe('+5491123456789');
  });

  it('handles JIDs without domain gracefully', () => {
    expect(phoneFromJid('12345')).toBe('+12345');
  });
});

describe('real-time message handling', () => {
  it('creates a prospect contact for unknown JID', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    mockWA.emit('message', {
      id: 'msg-1',
      jid: '5491100001111@s.whatsapp.net',
      sender: '5491100001111@s.whatsapp.net',
      pushName: 'Carlos',
      content: 'Hola',
      type: 'text' as const,
      timestamp: 1000,
      fromMe: false,
    });

    const contact = getContact(db, '5491100001111@s.whatsapp.net');
    expect(contact).not.toBeNull();
    expect(contact!.status).toBe('prospect');
    expect(contact!.name).toBe('Carlos');
    expect(contact!.phone).toBe('+5491100001111');
    expect(contact!.last_message_at).toBe(1000);
    expect(contact!.last_reply_at).toBe(1000);
  });

  it('updates last_reply_at only on inbound messages, not outbound', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    // Inbound message from contact
    mockWA.emit('message', {
      id: 'msg-in',
      jid: '5491100002222@s.whatsapp.net',
      sender: '5491100002222@s.whatsapp.net',
      pushName: 'Ana',
      content: 'Hola',
      type: 'text' as const,
      timestamp: 2000,
      fromMe: false,
    });

    const afterInbound = getContact(db, '5491100002222@s.whatsapp.net')!;
    expect(afterInbound.last_message_at).toBe(2000);
    expect(afterInbound.last_reply_at).toBe(2000);

    // Outbound message from me
    mockWA.emit('message', {
      id: 'msg-out',
      jid: '5491100002222@s.whatsapp.net',
      sender: 'me',
      content: 'How can I help?',
      type: 'text' as const,
      timestamp: 3000,
      fromMe: true,
    });

    const afterOutbound = getContact(db, '5491100002222@s.whatsapp.net')!;
    expect(afterOutbound.last_message_at).toBe(3000);
    expect(afterOutbound.last_reply_at).toBe(2000); // unchanged
  });

  it('does not overwrite existing contact data on new messages', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    // Pre-create contact
    upsertContact(db, {
      jid: '5491100003333@s.whatsapp.net',
      name: 'Existing Client',
      phone: '+5491100003333',
    });
    updateContact(db, '5491100003333@s.whatsapp.net', {
      notes: 'VIP customer',
      follow_up_date: '2026-07-01',
    });

    // New message arrives
    mockWA.emit('message', {
      id: 'msg-existing',
      jid: '5491100003333@s.whatsapp.net',
      sender: '5491100003333@s.whatsapp.net',
      pushName: 'New Push Name',
      content: 'Hey',
      type: 'text' as const,
      timestamp: 5000,
      fromMe: false,
    });

    const contact = getContact(db, '5491100003333@s.whatsapp.net')!;
    expect(contact.name).toBe('Existing Client');    // not overwritten (already has name)
    expect(contact.notes).toBe('VIP customer');      // preserved
    expect(contact.follow_up_date).toBe('2026-07-01'); // preserved
  });

  it('sets name from pushName only when contact has no name', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    // Pre-create contact without a name
    upsertContact(db, {
      jid: '5491100004444@s.whatsapp.net',
      phone: '+5491100004444',
    });
    expect(getContact(db, '5491100004444@s.whatsapp.net')!.name).toBeNull();

    // Message with pushName should set the name
    mockWA.emit('message', {
      id: 'msg-name-set',
      jid: '5491100004444@s.whatsapp.net',
      sender: '5491100004444@s.whatsapp.net',
      pushName: 'Diego',
      content: 'Hello',
      type: 'text' as const,
      timestamp: 1000,
      fromMe: false,
    });

    expect(getContact(db, '5491100004444@s.whatsapp.net')!.name).toBe('Diego');
  });

  it('emits message:new and contact:update events', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;
    const events: string[] = [];
    let emittedMessage: Message | null = null;
    let emittedContact: Contact | null = null;

    processor.on('message:new', (data) => {
      events.push('message:new');
      emittedMessage = data.message;
      emittedContact = data.contact;
    });
    processor.on('contact:update', () => {
      events.push('contact:update');
    });

    mockWA.emit('message', {
      id: 'msg-evt',
      jid: '5491100005555@s.whatsapp.net',
      sender: '5491100005555@s.whatsapp.net',
      pushName: 'Test',
      content: 'Event test',
      type: 'text' as const,
      timestamp: 9000,
      fromMe: false,
    });

    expect(events).toEqual(['message:new', 'contact:update']);
    expect(emittedMessage).not.toBeNull();
    expect(emittedMessage!.id).toBe('msg-evt');
    expect(emittedContact).not.toBeNull();
    expect(emittedContact!.jid).toBe('5491100005555@s.whatsapp.net');
  });
});

describe('history sync', () => {
  it('processes a batch of contacts and messages', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;
    let progressCount = 0;

    processor.on('history:sync:progress', (data) => {
      progressCount = data.processed;
    });

    mockWA.emit('history', {
      contacts: [
        { jid: '5491100010000@s.whatsapp.net', name: 'HistAlice', notify: undefined, phoneNumber: '+5491100010000' },
        { jid: '5491100020000@s.whatsapp.net', name: undefined, notify: 'BobNotify', phoneNumber: undefined },
      ],
      messages: [
        {
          id: 'hist-1',
          jid: '5491100010000@s.whatsapp.net',
          sender: '5491100010000@s.whatsapp.net',
          content: 'Old message from Alice',
          type: 'text' as const,
          timestamp: 500,
          fromMe: false,
        },
        {
          id: 'hist-2',
          jid: '5491100010000@s.whatsapp.net',
          sender: 'me',
          content: 'My reply to Alice',
          type: 'text' as const,
          timestamp: 600,
          fromMe: true,
        },
        {
          id: 'hist-3',
          jid: '5491100020000@s.whatsapp.net',
          sender: '5491100020000@s.whatsapp.net',
          content: 'Old message from Bob',
          type: 'text' as const,
          timestamp: 700,
          fromMe: false,
        },
      ],
    });

    // Contacts created
    const alice = getContact(db, '5491100010000@s.whatsapp.net');
    expect(alice).not.toBeNull();
    expect(alice!.name).toBe('HistAlice');
    expect(alice!.phone).toBe('+5491100010000');
    expect(alice!.status).toBe('prospect');

    const bob = getContact(db, '5491100020000@s.whatsapp.net');
    expect(bob).not.toBeNull();
    expect(bob!.name).toBe('BobNotify'); // falls back to notify
    expect(bob!.phone).toBe('+5491100020000'); // extracted from JID

    // Messages inserted
    const aliceMsgs = getMessages(db, '5491100010000@s.whatsapp.net', { limit: 100 });
    expect(aliceMsgs).toHaveLength(2);

    const bobMsgs = getMessages(db, '5491100020000@s.whatsapp.net', { limit: 100 });
    expect(bobMsgs).toHaveLength(1);

    // Timestamps updated
    expect(alice!.last_message_at).toBe(600); // latest of 500, 600
    expect(alice!.last_reply_at).toBe(500);   // only inbound: 500
    expect(bob!.last_message_at).toBe(700);
    expect(bob!.last_reply_at).toBe(700);

    // Progress event emitted
    expect(progressCount).toBe(3);
  });

  it('does not overwrite existing contact data during history sync', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    // Pre-create contact
    upsertContact(db, {
      jid: '5491100099999@s.whatsapp.net',
      name: 'Premium User',
      phone: '+5491100099999',
    });
    updateContact(db, '5491100099999@s.whatsapp.net', { notes: 'Do not change' });

    mockWA.emit('history', {
      contacts: [
        { jid: '5491100099999@s.whatsapp.net', name: 'Some Other Name', phoneNumber: '+5491100099999' },
      ],
      messages: [
        {
          id: 'hist-old',
          jid: '5491100099999@s.whatsapp.net',
          sender: '5491100099999@s.whatsapp.net',
          content: 'Old history msg',
          type: 'text' as const,
          timestamp: 100,
          fromMe: false,
        },
      ],
    });

    const contact = getContact(db, '5491100099999@s.whatsapp.net')!;
    expect(contact.name).toBe('Premium User');          // kept existing name (upsert merges)
    expect(contact.notes).toBe('Do not change');        // preserved
  });

  it('emits history:sync:done when history:done fires', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;
    let doneFired = false;

    processor.on('history:sync:done', () => {
      doneFired = true;
    });

    mockWA.emit('history:done');
    expect(doneFired).toBe(true);
  });
});

describe('label handling', () => {
  it('handles label:edit event — creates a new label', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;
    let emittedLabels: Label[] | null = null;

    processor.on('label:update', (data) => {
      emittedLabels = data.labels;
    });

    mockWA.emit('label:edit', {
      id: 'L1',
      name: 'Nuevo cliente',
      color: 0,
      deleted: false,
    });

    const labels = getLabels(db);
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('Nuevo cliente');
    expect(emittedLabels).not.toBeNull();
    expect(emittedLabels!).toHaveLength(1);
  });

  it('handles label:edit with deleted=true — soft-deletes label', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    // First create a label
    mockWA.emit('label:edit', {
      id: 'L1',
      name: 'Test',
      color: 0,
      deleted: false,
    });
    expect(getLabels(db)).toHaveLength(1);

    // Then delete it
    mockWA.emit('label:edit', {
      id: 'L1',
      name: 'Test',
      color: 0,
      deleted: true,
    });
    expect(getLabels(db)).toHaveLength(0);
  });

  it('handles label:association add — links contact to label', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    upsertContact(db, { jid: '5491100001111@s.whatsapp.net', name: 'Alice' });
    upsertLabel(db, { id: 'L1', name: 'VIP', color: 1 });

    let emittedData: { jid: string; labels: Label[] } | null = null;
    processor.on('contact:labels', (data) => {
      emittedData = data;
    });

    mockWA.emit('label:association', {
      chatId: '5491100001111@s.whatsapp.net',
      labelId: 'L1',
      type: 'add',
    });

    const labels = getContactLabels(db, '5491100001111@s.whatsapp.net');
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('VIP');
    expect(emittedData).not.toBeNull();
    expect(emittedData!.jid).toBe('5491100001111@s.whatsapp.net');
    expect(emittedData!.labels).toHaveLength(1);
  });

  it('handles label:association remove — unlinks contact from label', () => {
    const mockWA = wa as unknown as EventEmitter<WhatsAppManagerEvents>;

    upsertContact(db, { jid: '5491100001111@s.whatsapp.net', name: 'Alice' });
    upsertLabel(db, { id: 'L1', name: 'VIP', color: 1 });
    setContactLabel(db, '5491100001111@s.whatsapp.net', 'L1');

    mockWA.emit('label:association', {
      chatId: '5491100001111@s.whatsapp.net',
      labelId: 'L1',
      type: 'remove',
    });

    const labels = getContactLabels(db, '5491100001111@s.whatsapp.net');
    expect(labels).toHaveLength(0);
  });
});
