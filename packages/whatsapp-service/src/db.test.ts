import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDatabase,
  upsertContact,
  getContact,
  getContacts,
  updateContact,
  insertMessage,
  getMessages,
  getDashboardStats,
  bulkInsertMessages,
  upsertLabel,
  deleteLabel,
  getLabels,
  setContactLabel,
  removeContactLabel,
  getContactLabels,
} from './db.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDatabase(':memory:');
});

describe('upsertContact + getContact', () => {
  it('inserts a new contact and retrieves it with all fields', () => {
    upsertContact(db, { jid: 'user1@s.whatsapp.net', name: 'Alice', phone: '+598123456' });

    const contact = getContact(db, 'user1@s.whatsapp.net');
    expect(contact).not.toBeNull();
    expect(contact!.jid).toBe('user1@s.whatsapp.net');
    expect(contact!.name).toBe('Alice');
    expect(contact!.phone).toBe('+598123456');
    expect(contact!.status).toBe('prospect');
    expect(contact!.last_message_at).toBeNull();
    expect(contact!.last_reply_at).toBeNull();
    expect(contact!.follow_up_date).toBeNull();
    expect(contact!.notes).toBe('');
    expect(contact!.created_at).toBeTypeOf('number');
    expect(contact!.updated_at).toBeTypeOf('number');
    expect(contact!.labels).toEqual([]);
  });

  it('upsert preserves existing fields when not provided', () => {
    upsertContact(db, { jid: 'u1@s.whatsapp.net', name: 'Alice', phone: '+598111' });
    const original = getContact(db, 'u1@s.whatsapp.net')!;

    // Update only name — phone should be preserved
    upsertContact(db, { jid: 'u1@s.whatsapp.net', name: 'Alice Updated' });
    const updated = getContact(db, 'u1@s.whatsapp.net')!;

    expect(updated.name).toBe('Alice Updated');
    expect(updated.phone).toBe('+598111');
    expect(updated.created_at).toBe(original.created_at);
    expect(updated.updated_at).toBeGreaterThanOrEqual(original.updated_at);
  });

  it('returns null for non-existent contact', () => {
    expect(getContact(db, 'nonexistent@s.whatsapp.net')).toBeNull();
  });
});

describe('insertMessage + getMessages', () => {
  beforeEach(() => {
    upsertContact(db, { jid: 'c1@s.whatsapp.net', name: 'Bob' });
  });

  it('inserts messages and paginates with getMessages', () => {
    // Insert 5 messages with ascending timestamps
    for (let i = 1; i <= 5; i++) {
      insertMessage(db, {
        id: `msg-${i}`,
        contact_jid: 'c1@s.whatsapp.net',
        sender: i % 2 === 0 ? 'me' : 'c1@s.whatsapp.net',
        content: `Message ${i}`,
        timestamp: 1000 + i,
      });
    }

    // Default: desc order, limit 50
    const all = getMessages(db, 'c1@s.whatsapp.net');
    expect(all).toHaveLength(5);
    expect(all[0].timestamp).toBe(1005);
    expect(all[4].timestamp).toBe(1001);

    // Paginate: limit 2
    const page1 = getMessages(db, 'c1@s.whatsapp.net', { limit: 2 });
    expect(page1).toHaveLength(2);
    expect(page1[0].id).toBe('msg-5');
    expect(page1[1].id).toBe('msg-4');

    // Paginate: before timestamp
    const page2 = getMessages(db, 'c1@s.whatsapp.net', {
      before: page1[1].timestamp,
      limit: 2,
    });
    expect(page2).toHaveLength(2);
    expect(page2[0].id).toBe('msg-3');
    expect(page2[1].id).toBe('msg-2');
  });

  it('updates contact last_message_at and last_reply_at on message insert', () => {
    insertMessage(db, {
      id: 'msg-from-contact',
      contact_jid: 'c1@s.whatsapp.net',
      sender: 'c1@s.whatsapp.net',
      content: 'Hello',
      timestamp: 5000,
    });

    const contact = getContact(db, 'c1@s.whatsapp.net')!;
    expect(contact.last_message_at).toBe(5000);
    expect(contact.last_reply_at).toBe(5000);

    // Message from 'me' should update last_message_at but NOT last_reply_at
    insertMessage(db, {
      id: 'msg-from-me',
      contact_jid: 'c1@s.whatsapp.net',
      sender: 'me',
      content: 'Hi back',
      timestamp: 6000,
    });

    const updated = getContact(db, 'c1@s.whatsapp.net')!;
    expect(updated.last_message_at).toBe(6000);
    expect(updated.last_reply_at).toBe(5000); // unchanged
  });
});

describe('updateContact', () => {
  it('updates notes and follow_up_date', () => {
    upsertContact(db, { jid: 'u3@s.whatsapp.net', name: 'Diana' });
    updateContact(db, 'u3@s.whatsapp.net', {
      notes: 'Interested in premium plan',
      follow_up_date: '2026-06-01',
    });

    const contact = getContact(db, 'u3@s.whatsapp.net')!;
    expect(contact.notes).toBe('Interested in premium plan');
    expect(contact.follow_up_date).toBe('2026-06-01');
  });
});

describe('getContacts filters', () => {
  beforeEach(() => {
    upsertContact(db, { jid: 'a@s.whatsapp.net', name: 'Alice', phone: '+1111' });
    upsertContact(db, { jid: 'b@s.whatsapp.net', name: 'Bob', phone: '+2222' });
    upsertContact(db, { jid: 'c@s.whatsapp.net', name: 'Charlie', phone: '+3333' });
    upsertContact(db, { jid: 'j@s.whatsapp.net', name: 'John', phone: '+4444' });
  });

  it('filters inactive contacts by inactive_days', () => {
    // Give Alice a recent reply (now), give Bob an old reply (10 days ago)
    const now = Date.now();
    insertMessage(db, {
      id: 'r1',
      contact_jid: 'a@s.whatsapp.net',
      sender: 'a@s.whatsapp.net',
      content: 'hi',
      timestamp: now,
    });
    insertMessage(db, {
      id: 'r2',
      contact_jid: 'b@s.whatsapp.net',
      sender: 'b@s.whatsapp.net',
      content: 'hi',
      timestamp: now - 10 * 24 * 60 * 60 * 1000,
    });
    // Charlie and John have no reply at all (null last_reply_at)

    const inactive = getContacts(db, { inactive_days: 3 });
    // Should include Bob (old reply), Charlie (null), John (null) — not Alice (recent)
    expect(inactive).toHaveLength(3);
    const jids = inactive.map((c) => c.jid);
    expect(jids).not.toContain('a@s.whatsapp.net');
    expect(jids).toContain('b@s.whatsapp.net');
    expect(jids).toContain('c@s.whatsapp.net');
    expect(jids).toContain('j@s.whatsapp.net');
  });

  it('filters by search (name)', () => {
    const results = getContacts(db, { search: 'john' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('John');
  });

  it('filters by search (phone)', () => {
    const results = getContacts(db, { search: '2222' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Bob');
  });
});

describe('getDashboardStats', () => {
  it('returns correct counts after inserting test data', () => {
    const now = Date.now();

    upsertContact(db, { jid: 'p1@s.whatsapp.net', name: 'P1' });
    upsertContact(db, { jid: 'p2@s.whatsapp.net', name: 'P2' });
    upsertContact(db, { jid: 'c1@s.whatsapp.net', name: 'C1' });
    upsertContact(db, { jid: 'c2@s.whatsapp.net', name: 'C2' });

    // 1 with pending follow-up (today or past)
    updateContact(db, 'p1@s.whatsapp.net', { follow_up_date: '2020-01-01' });

    // 1 with future follow-up (should NOT count)
    updateContact(db, 'p2@s.whatsapp.net', { follow_up_date: '2099-12-31' });

    // Give c1 a recent reply (active), c2 an old reply (inactive)
    insertMessage(db, {
      id: 'm1',
      contact_jid: 'c1@s.whatsapp.net',
      sender: 'c1@s.whatsapp.net',
      content: 'hi',
      timestamp: now,
    });
    insertMessage(db, {
      id: 'm2',
      contact_jid: 'c2@s.whatsapp.net',
      sender: 'c2@s.whatsapp.net',
      content: 'hi',
      timestamp: now - 30 * 24 * 60 * 60 * 1000,
    });
    // p1 and p2 have null last_reply_at => inactive

    const stats = getDashboardStats(db);
    expect(stats.total).toBe(4);
    expect(stats.pendingFollowUps).toBe(1);
    expect(stats.inactive).toBe(3); // p1, p2 (null), c2 (old)
    expect(stats.labels).toEqual([]);
  });
});

describe('bulkInsertMessages', () => {
  it('inserts 100 messages in a single transaction', () => {
    upsertContact(db, { jid: 'bulk@s.whatsapp.net', name: 'Bulk' });

    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `bulk-${i}`,
      contact_jid: 'bulk@s.whatsapp.net',
      sender: i % 2 === 0 ? 'me' : 'bulk@s.whatsapp.net',
      content: `Message ${i}`,
      timestamp: 1000 + i,
    }));

    bulkInsertMessages(db, messages);

    const all = getMessages(db, 'bulk@s.whatsapp.net', { limit: 200 });
    expect(all).toHaveLength(100);
  });
});

describe('duplicate message handling', () => {
  it('INSERT OR IGNORE does not error on duplicate message id', () => {
    upsertContact(db, { jid: 'dup@s.whatsapp.net', name: 'Dup' });

    insertMessage(db, {
      id: 'same-id',
      contact_jid: 'dup@s.whatsapp.net',
      sender: 'dup@s.whatsapp.net',
      content: 'First',
      timestamp: 1000,
    });

    // Should not throw
    expect(() => {
      insertMessage(db, {
        id: 'same-id',
        contact_jid: 'dup@s.whatsapp.net',
        sender: 'dup@s.whatsapp.net',
        content: 'Duplicate',
        timestamp: 2000,
      });
    }).not.toThrow();

    // Original content preserved (INSERT OR IGNORE keeps the first)
    const msgs = getMessages(db, 'dup@s.whatsapp.net');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('First');
  });
});

describe('labels', () => {
  it('upsertLabel inserts and retrieves a label', () => {
    upsertLabel(db, { id: 'label-1', name: 'Nuevo cliente', color: 0 });
    const labels = getLabels(db);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toEqual({ id: 'label-1', name: 'Nuevo cliente', color: 0, predefined_id: null });
  });

  it('upsertLabel updates an existing label', () => {
    upsertLabel(db, { id: 'label-1', name: 'Nuevo cliente', color: 0 });
    upsertLabel(db, { id: 'label-1', name: 'Cliente VIP', color: 3 });
    const labels = getLabels(db);
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('Cliente VIP');
    expect(labels[0].color).toBe(3);
  });

  it('deleteLabel soft-deletes and cleans junction table', () => {
    upsertContact(db, { jid: 'c1@s.whatsapp.net', name: 'Alice' });
    upsertLabel(db, { id: 'label-1', name: 'Test', color: 0 });
    setContactLabel(db, 'c1@s.whatsapp.net', 'label-1');

    deleteLabel(db, 'label-1');

    expect(getLabels(db)).toHaveLength(0);
    expect(getContactLabels(db, 'c1@s.whatsapp.net')).toHaveLength(0);
  });

  it('setContactLabel and removeContactLabel manage associations', () => {
    upsertContact(db, { jid: 'c1@s.whatsapp.net', name: 'Alice' });
    upsertLabel(db, { id: 'L1', name: 'Label1', color: 1 });
    upsertLabel(db, { id: 'L2', name: 'Label2', color: 2 });

    setContactLabel(db, 'c1@s.whatsapp.net', 'L1');
    setContactLabel(db, 'c1@s.whatsapp.net', 'L2');

    const labels = getContactLabels(db, 'c1@s.whatsapp.net');
    expect(labels).toHaveLength(2);

    removeContactLabel(db, 'c1@s.whatsapp.net', 'L1');
    expect(getContactLabels(db, 'c1@s.whatsapp.net')).toHaveLength(1);
    expect(getContactLabels(db, 'c1@s.whatsapp.net')[0].id).toBe('L2');
  });

  it('setContactLabel is idempotent (INSERT OR IGNORE)', () => {
    upsertContact(db, { jid: 'c1@s.whatsapp.net', name: 'Alice' });
    upsertLabel(db, { id: 'L1', name: 'Label1', color: 1 });

    setContactLabel(db, 'c1@s.whatsapp.net', 'L1');
    setContactLabel(db, 'c1@s.whatsapp.net', 'L1'); // duplicate

    expect(getContactLabels(db, 'c1@s.whatsapp.net')).toHaveLength(1);
  });

  it('getContact returns labels', () => {
    upsertContact(db, { jid: 'c1@s.whatsapp.net', name: 'Alice' });
    upsertLabel(db, { id: 'L1', name: 'Label1', color: 1 });
    setContactLabel(db, 'c1@s.whatsapp.net', 'L1');

    const contact = getContact(db, 'c1@s.whatsapp.net');
    expect(contact!.labels).toHaveLength(1);
    expect(contact!.labels[0].name).toBe('Label1');
  });

  it('getContacts with label filter returns only matching contacts', () => {
    upsertContact(db, { jid: 'a@s.whatsapp.net', name: 'Alice' });
    upsertContact(db, { jid: 'b@s.whatsapp.net', name: 'Bob' });
    upsertLabel(db, { id: 'L1', name: 'VIP', color: 0 });
    setContactLabel(db, 'a@s.whatsapp.net', 'L1');

    const filtered = getContacts(db, { label: 'L1' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].jid).toBe('a@s.whatsapp.net');

    const all = getContacts(db);
    expect(all).toHaveLength(2);
  });

  it('getDashboardStats includes label counts', () => {
    upsertContact(db, { jid: 'a@s.whatsapp.net', name: 'Alice' });
    upsertContact(db, { jid: 'b@s.whatsapp.net', name: 'Bob' });
    upsertLabel(db, { id: 'L1', name: 'VIP', color: 0 });
    upsertLabel(db, { id: 'L2', name: 'Nuevo', color: 1 });
    setContactLabel(db, 'a@s.whatsapp.net', 'L1');
    setContactLabel(db, 'b@s.whatsapp.net', 'L1');
    setContactLabel(db, 'a@s.whatsapp.net', 'L2');

    const stats = getDashboardStats(db);
    expect(stats.labels).toHaveLength(2);
    const vip = stats.labels.find(l => l.id === 'L1');
    expect(vip!.count).toBe(2);
    const nuevo = stats.labels.find(l => l.id === 'L2');
    expect(nuevo!.count).toBe(1);
  });
});
