# mini-crm-wpp

Mini CRM with WhatsApp Web integration. Self-hosted, single-user.

## Architecture

Monorepo with two packages:
- `packages/whatsapp-service` — Node.js backend: Baileys v7 + Express + SQLite + WebSocket
- `packages/crm-web` — Next.js 15 frontend: App Router + Tailwind CSS

## Dev Commands

```bash
# Backend
cd packages/whatsapp-service
npm install
npm run dev          # tsx --watch

# Frontend
cd packages/crm-web
npm install
npm run dev          # next dev

# Docker (full stack)
docker compose -f docker-compose.dev.yml up
```

## Ports

- 3000: Web UI (Next.js)
- 3001: REST API (Express)
- 3002: WebSocket (ws)

## Database

SQLite at `/data/crm.db`. Tables: `contacts`, `messages`.

## Key Files

- `packages/whatsapp-service/src/index.ts` — entry point
- `packages/whatsapp-service/src/db.ts` — database layer
- `packages/whatsapp-service/src/whatsapp.ts` — Baileys connection manager
- `packages/whatsapp-service/src/processor.ts` — message processing
- `packages/whatsapp-service/src/api.ts` — REST API routes
