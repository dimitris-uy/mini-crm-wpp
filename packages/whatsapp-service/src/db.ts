import Database from 'better-sqlite3';
import type { Contact, DashboardStats, Label, Message } from './types.js';

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

  CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color INTEGER NOT NULL,
    predefined_id TEXT,
    deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contact_labels (
    contact_jid TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (contact_jid, label_id),
    FOREIGN KEY (contact_jid) REFERENCES contacts(jid),
    FOREIGN KEY (label_id) REFERENCES labels(id)
  );

  CREATE INDEX IF NOT EXISTS idx_contact_labels_label ON contact_labels(label_id);
`;

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

// ---------------------------------------------------------------------------
// Label CRUD
// ---------------------------------------------------------------------------

export function upsertLabel(
  db: Database.Database,
  data: { id: string; name: string; color: number; predefined_id?: string },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO labels (id, name, color, predefined_id, deleted)
     VALUES (?, ?, ?, ?, 0)`,
  ).run(data.id, data.name, data.color, data.predefined_id ?? null);
}

export function deleteLabel(db: Database.Database, id: string): void {
  const transaction = db.transaction(() => {
    db.prepare('UPDATE labels SET deleted = 1 WHERE id = ?').run(id);
    db.prepare('DELETE FROM contact_labels WHERE label_id = ?').run(id);
  });
  transaction();
}

export function getLabels(db: Database.Database): Label[] {
  return db
    .prepare('SELECT id, name, color, predefined_id FROM labels WHERE deleted = 0')
    .all() as Label[];
}

export function setContactLabel(
  db: Database.Database,
  contactJid: string,
  labelId: string,
): void {
  db.prepare(
    'INSERT OR IGNORE INTO contact_labels (contact_jid, label_id) VALUES (?, ?)',
  ).run(contactJid, labelId);
}

export function removeContactLabel(
  db: Database.Database,
  contactJid: string,
  labelId: string,
): void {
  db.prepare(
    'DELETE FROM contact_labels WHERE contact_jid = ? AND label_id = ?',
  ).run(contactJid, labelId);
}

export function getContactLabels(
  db: Database.Database,
  contactJid: string,
): Label[] {
  return db
    .prepare(
      `SELECT l.id, l.name, l.color, l.predefined_id
       FROM labels l
       JOIN contact_labels cl ON l.id = cl.label_id
       WHERE cl.contact_jid = ? AND l.deleted = 0`,
    )
    .all(contactJid) as Label[];
}

// ---------------------------------------------------------------------------
// Contact CRUD
// ---------------------------------------------------------------------------

export function upsertContact(
  db: Database.Database,
  data: { jid: string; name?: string; phone?: string },
): void {
  const now = Date.now();
  const existing = db
    .prepare('SELECT * FROM contacts WHERE jid = ?')
    .get(data.jid) as (Omit<Contact, 'labels'>) | undefined;

  if (existing) {
    const merged = {
      jid: data.jid,
      name: data.name ?? existing.name,
      phone: data.phone ?? existing.phone,
      status: existing.status,
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
      'prospect',
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
    .get(jid) as (Omit<Contact, 'labels'>) | undefined;
  if (!row) return null;
  const labels = getContactLabels(db, jid);
  return { ...row, labels };
}

export interface GetContactsFilters {
  label?: string;
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

  if (filters.label) {
    conditions.push('EXISTS (SELECT 1 FROM contact_labels WHERE contact_labels.contact_jid = contacts.jid AND contact_labels.label_id = ?)');
    params.push(filters.label);
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

  const contacts = db
    .prepare(`SELECT * FROM contacts ${where} ${orderBy}`)
    .all(...params) as Array<Omit<Contact, 'labels'>>;

  // Batch-fetch labels for all returned contacts
  const jids = contacts.map(c => c.jid);
  if (jids.length > 0) {
    const placeholders = jids.map(() => '?').join(',');
    const labelRows = db.prepare(
      `SELECT cl.contact_jid, l.id, l.name, l.color, l.predefined_id
       FROM contact_labels cl
       JOIN labels l ON l.id = cl.label_id
       WHERE cl.contact_jid IN (${placeholders}) AND l.deleted = 0`
    ).all(...jids) as Array<{ contact_jid: string; id: string; name: string; color: number; predefined_id: string | null }>;

    const labelMap = new Map<string, Label[]>();
    for (const row of labelRows) {
      const arr = labelMap.get(row.contact_jid) ?? [];
      arr.push({ id: row.id, name: row.name, color: row.color, predefined_id: row.predefined_id });
      labelMap.set(row.contact_jid, arr);
    }

    return contacts.map(c => ({ ...c, labels: labelMap.get(c.jid) ?? [] }));
  }
  return contacts.map(c => ({ ...c, labels: [] }));
}

export function updateContact(
  db: Database.Database,
  jid: string,
  fields: Partial<{ name: string; notes: string; follow_up_date: string | null }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

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

  const row = db.prepare(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN follow_up_date IS NOT NULL AND follow_up_date <= ? THEN 1 ELSE 0 END) as pendingFollowUps,
      SUM(CASE WHEN last_reply_at IS NULL OR last_reply_at < ? THEN 1 ELSE 0 END) as inactive
    FROM contacts`
  ).get(today, sevenDaysAgo) as { total: number; pendingFollowUps: number; inactive: number };

  const labelCounts = db.prepare(
    `SELECT l.id, l.name, l.color, COUNT(cl.contact_jid) as count
     FROM labels l
     LEFT JOIN contact_labels cl ON cl.label_id = l.id
     WHERE l.deleted = 0
     GROUP BY l.id
     ORDER BY l.name`
  ).all() as Array<{ id: string; name: string; color: number; count: number }>;

  return { ...row, labels: labelCounts };
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
