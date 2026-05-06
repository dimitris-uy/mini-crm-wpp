/**
 * Entry point — wires database, WhatsApp, processor, REST API, and WebSocket.
 */

import fs from 'fs';
import express from 'express';
import pino from 'pino';
import { initDatabase } from './db.js';
import { WhatsAppManager } from './whatsapp.js';
import { MessageProcessor } from './processor.js';
import { createRouter } from './api.js';
import { createWSServer } from './ws.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.DATA_DIR || './data';
const API_PORT = parseInt(process.env.API_PORT || '3001', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '3002', 10);

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// 1. Database
const db = initDatabase(`${DATA_DIR}/crm.db`);

// 2. WhatsApp manager
const wa = new WhatsAppManager(`${DATA_DIR}/auth`);

// 3. Message processor (bridges WA -> DB, emits events)
const processor = new MessageProcessor(db, wa);

// 4. Express app
const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use('/api', createRouter(db, wa));

// 5. Start HTTP server
app.listen(API_PORT, () => {
  logger.info(`API server on :${API_PORT}`);
});

// 6. Start WebSocket server
const wss = createWSServer(WS_PORT, processor, wa);
logger.info(`WebSocket server on :${WS_PORT}`);

// 7. Connect WhatsApp (after servers are ready)
wa.connect().catch((err) => {
  logger.error(err, 'WhatsApp connection failed');
});

// 8. Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await wa.disconnect();
  db.close();
  wss.close();
  process.exit(0);
});
