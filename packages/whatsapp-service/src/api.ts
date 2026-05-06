/**
 * REST API Router
 *
 * All endpoints are mounted under /api in index.ts.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { WhatsAppManager } from './whatsapp.js';
import {
  getContacts,
  getContact,
  updateContact,
  getMessages,
  getDashboardStats,
  upsertContact,
  insertMessage,
} from './db.js';
import type { Message } from './types.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateContactSchema = z.object({
  status: z.enum(['prospect', 'client']).optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
  follow_up_date: z.string().nullable().optional(),
});

const sendMessageSchema = z.object({
  jid: z.string().min(1),
  text: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap an async route handler so rejected promises are forwarded to Express
 * error handling. Express 5 does this natively but the wrapper keeps the
 * types clean and the intent explicit.
 */
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createRouter(db: Database.Database, wa: WhatsAppManager): Router {
  const router = Router();

  // Track the last QR code so the frontend can poll even if it missed the
  // WebSocket event. Cleared on successful connection.
  let lastQr: string | null = null;

  wa.on('qr', (qr) => {
    lastQr = qr;
  });
  wa.on('connection', (state) => {
    if (state === 'connected') lastQr = null;
  });

  // ----- GET /status -----
  router.get('/status', (_req, res) => {
    res.json({
      connected: wa.getState() === 'connected',
      phone: wa.getPhone(),
    });
  });

  // ----- GET /qr -----
  router.get('/qr', (_req, res) => {
    res.json({ qr: lastQr });
  });

  // ----- POST /disconnect -----
  router.post(
    '/disconnect',
    asyncHandler(async (_req, res) => {
      await wa.disconnect();
      res.json({ ok: true });
    }),
  );

  // ----- GET /contacts -----
  router.get('/contacts', (req, res) => {
    const status = req.query.status as string | undefined;
    const sort = req.query.sort as string | undefined;
    const inactive_days = req.query.inactive_days
      ? parseInt(req.query.inactive_days as string, 10)
      : undefined;
    const search = req.query.search as string | undefined;

    const contacts = getContacts(db, {
      status: status === 'prospect' || status === 'client' ? status : undefined,
      sort: sort === 'name' || sort === 'last_message' || sort === 'last_reply' ? sort : undefined,
      inactive_days: inactive_days !== undefined && !isNaN(inactive_days) ? inactive_days : undefined,
      search,
    });

    res.json(contacts);
  });

  // ----- GET /contacts/:jid -----
  router.get('/contacts/:jid', (req, res) => {
    const contact = getContact(db, req.params.jid);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json(contact);
  });

  // ----- PATCH /contacts/:jid -----
  router.patch('/contacts/:jid', (req, res) => {
    const parsed = updateContactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }

    const contact = getContact(db, req.params.jid);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    updateContact(db, req.params.jid, parsed.data);
    const updated = getContact(db, req.params.jid);
    res.json(updated);
  });

  // ----- GET /contacts/:jid/messages -----
  router.get('/contacts/:jid/messages', (req, res) => {
    const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
    let limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;

    const messages = getMessages(db, req.params.jid, { before, limit });
    res.json(messages);
  });

  // ----- POST /messages/send -----
  router.post(
    '/messages/send',
    asyncHandler(async (req, res) => {
      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues });
        return;
      }

      const { jid, text } = parsed.data;

      // Ensure contact exists (create as prospect if new)
      upsertContact(db, { jid, phone: `+${jid.split('@')[0]}` });

      // Send via WhatsApp
      await wa.sendMessage(jid, text);

      // Store in DB
      const now = Date.now();
      const msgId = randomUUID();
      insertMessage(db, {
        id: msgId,
        contact_jid: jid,
        sender: 'me',
        content: text,
        type: 'text',
        timestamp: now,
      });

      const message: Message = {
        id: msgId,
        contact_jid: jid,
        sender: 'me',
        content: text,
        type: 'text',
        timestamp: now,
      };

      res.json(message);
    }),
  );

  // ----- GET /dashboard -----
  router.get('/dashboard', (_req, res) => {
    const stats = getDashboardStats(db);
    res.json(stats);
  });

  // ----- Error handler -----
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as any).status ?? 500;
    res.status(status).json({ error: err.message ?? 'Internal server error' });
  });

  return router;
}
