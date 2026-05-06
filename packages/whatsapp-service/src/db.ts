import Database from 'better-sqlite3';
import type { Contact, DashboardStats, Message } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS contacts (
    jid TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'prospect',
    last_message_at INTEGER,
    last_reply_at INTEGER,
    follow_up_date TEXT,
    notes TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    contact_jid TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (contact_jid) REFERENCES contacts(jid)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_jid, timestamp);
  CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
  CREATE INDEX IF NOT EXISTS idx_contacts_follow_up ON contacts(follow_up_date);
`;

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function upsertContact(
  db: Database.Database,
  data: { jid: string; name?: string; phone?: string; status?: 'prospect' | 'client' },
): void {
  const now = Date.now();
  const existing = db
    .prepare('SELECT * FROM contacts WHERE jid = ?')
    .get(data.jid) as Contact | undefined;

  if (existing) {
    const merged = {
      jid: data.jid,
      name: data.name ?? existing.name,
      phone: data.phone ?? existing.phone,
      status: data.status ?? existing.status,
      last_message_at: existing.last_message_at,
      last_reply_at: existing.last_reply_at,
      follow_up_date: existing.follow_up_date,
      notes: existing.notes,
      created_at: existing.created_at,
      updated_at: now,
    };
    db.prepare(
      `INSERT OR REPLACE INTO contacts (jid, name, phone, status, last_message_at, last_reply_at, follow_up_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      merged.jid,
      merged.name,
      merged.phone,
      merged.status,
      merged.last_message_at,
      merged.last_reply_at,
      merged.follow_up_date,
      merged.notes,
      merged.created_at,
      merged.updated_at,
    );
  } else {
    db.prepare(
      `INSERT INTO contacts (jid, name, phone, status, last_message_at, last_reply_at, follow_up_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.jid,
      data.name ?? null,
      data.phone ?? null,
      data.status ?? 'prospect',
      null,
      null,
      null,
      '',
      now,
      now,
    );
  }
}

export function getContact(
  db: Database.Database,
  jid: string,
): Contact | null {
  const row = db
    .prepare('SELECT * FROM contacts WHERE jid = ?')
    .get(jid) as Contact | undefined;
  return row ?? null;
}

export interface GetContactsFilters {
  status?: 'prospect' | 'client';
  sort?: 'name' | 'last_message' | 'last_reply';
  inactive_days?: number;
  search?: string;
}

export function getContacts(
  db: Database.Database,
  filters: GetContactsFilters = {},
): Contact[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.inactive_days !== undefined) {
    const cutoff = Date.now() - filters.inactive_days * 24 * 60 * 60 * 1000;
    conditions.push('(last_reply_at IS NULL OR last_reply_at < ?)');
    params.push(cutoff);
  }

  if (filters.search) {
    conditions.push('(name LIKE ? OR phone LIKE ?)');
    const pattern = `%${filters.search}%`;
    params.push(pattern, pattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  switch (filters.sort) {
    case 'name':
      orderBy = 'ORDER BY name ASC';
      break;
    case 'last_reply':
      orderBy = 'ORDER BY last_reply_at DESC';
      break;
    case 'last_message':
    default:
      orderBy = 'ORDER BY last_message_at DESC';
      break;
  }

  return db
    .prepare(`SELECT * FROM contacts ${where} ${orderBy}`)
    .all(...params) as Contact[];
}

export function updateContact(
  db: Database.Database,
  jid: string,
  fields: Partial<{ status: 'prospect' | 'client'; name: string; notes: string; follow_up_date: string | null }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.status !== undefined) {
    sets.push('status = ?');
    params.push(fields.status);
  }
  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name);
  }
  if (fields.notes !== undefined) {
    sets.push('notes = ?');
    params.push(fields.notes);
  }
  if (fields.follow_up_date !== undefined) {
    sets.push('follow_up_date = ?');
    params.push(fields.follow_up_date);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(jid);

  db.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE jid = ?`).run(
    ...params,
  );
}

export function insertMessage(
  db: Database.Database,
  msg: {
    id: string;
    contact_jid: string;
    sender: string;
    content: string;
    type?: 'text' | 'image' | 'audio' | 'video' | 'document';
    timestamp: number;
  },
): void {
  db.prepare(
    `INSERT OR IGNORE INTO messages (id, contact_jid, sender, content, type, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    msg.id,
    msg.contact_jid,
    msg.sender,
    msg.content,
    msg.type ?? 'text',
    msg.timestamp,
  );

  // Update contact timestamps
  db.prepare(
    `UPDATE contacts SET last_message_at = MAX(COALESCE(last_message_at, 0), ?), updated_at = ? WHERE jid = ?`,
  ).run(msg.timestamp, Date.now(), msg.contact_jid);

  // If message is FROM the contact (not 'me'), update last_reply_at
  if (msg.sender !== 'me') {
    db.prepare(
      `UPDATE contacts SET last_reply_at = MAX(COALESCE(last_reply_at, 0), ?), updated_at = ? WHERE jid = ?`,
    ).run(msg.timestamp, Date.now(), msg.contact_jid);
  }
}

export function getMessages(
  db: Database.Database,
  jid: string,
  opts?: { before?: number; limit?: number },
): Message[] {
  const limit = opts?.limit ?? 50;

  if (opts?.before !== undefined) {
    return db
      .prepare(
        `SELECT * FROM messages WHERE contact_jid = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(jid, opts.before, limit) as Message[];
  }

  return db
    .prepare(
      `SELECT * FROM messages WHERE contact_jid = ? ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(jid, limit) as Message[];
}

export function getDashboardStats(db: Database.Database): DashboardStats {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const row = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'prospect' THEN 1 ELSE 0 END) as prospects,
        SUM(CASE WHEN status = 'client' THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN follow_up_date IS NOT NULL AND follow_up_date <= ? THEN 1 ELSE 0 END) as pendingFollowUps,
        SUM(CASE WHEN last_reply_at IS NULL OR last_reply_at < ? THEN 1 ELSE 0 END) as inactive
      FROM contacts`,
    )
    .get(today, sevenDaysAgo) as DashboardStats;

  return row;
}

export function bulkInsertMessages(
  db: Database.Database,
  messages: Array<{
    id: string;
    contact_jid: string;
    sender: string;
    content: string;
    type?: 'text' | 'image' | 'audio' | 'video' | 'document';
    timestamp: number;
  }>,
): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO messages (id, contact_jid, sender, content, type, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const transaction = db.transaction(() => {
    for (const msg of messages) {
      insert.run(
        msg.id,
        msg.contact_jid,
        msg.sender,
        msg.content,
        msg.type ?? 'text',
        msg.timestamp,
      );
    }
  });

  transaction();
}
