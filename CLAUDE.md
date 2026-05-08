# mini-crm-wpp

Mini CRM with WhatsApp Web integration. Self-hosted, single-user system for managing contacts and conversations via Baileys (unofficial WhatsApp Web API).

## Architecture

```
┌──────────────────┐   HTTP :3000    ┌───────────────────┐
│   crm-web        │ ──────────────► │  whatsapp-service  │
│   (Next.js 16)   │   WS :3002     │  (Express + WS)    │
│   App Router     │ ◄─────────────  │  Baileys v7        │
│   Tailwind CSS   │                 │  SQLite (WAL)      │
└──────────────────┘                 └───────────────────┘
                                            │
                                     WhatsApp Web
```

Monorepo with two packages:
- `packages/whatsapp-service` — Node.js backend: Baileys v7 + Express 5 + better-sqlite3 + ws
- `packages/crm-web` — Next.js 16 frontend: App Router + Tailwind CSS v4

## Dev Commands

```bash
# Backend
cd packages/whatsapp-service
npm install
npm run dev          # tsx --watch src/index.ts
npm run build        # tsc
npm run test         # vitest run
npm run typecheck    # tsc --noEmit

# Frontend
cd packages/crm-web
npm install
npm run dev          # next dev
npm run build        # next build
npm run lint         # eslint

# Docker (full stack)
docker compose up
```

## Ports

| Port | Service              |
|------|----------------------|
| 3000 | Web UI (Next.js)     |
| 3001 | REST API (Express)   |
| 3002 | WebSocket (ws)       |

## API Endpoints

All routes are mounted under `/api`.

| Method | Path                       | Description                        |
|--------|----------------------------|------------------------------------|
| GET    | /api/status                | WhatsApp connection status + phone |
| GET    | /api/qr                   | Latest QR code for pairing         |
| POST   | /api/disconnect            | Disconnect WhatsApp session        |
| GET    | /api/contacts              | List contacts (filterable)         |
| GET    | /api/contacts/:jid         | Single contact detail              |
| PATCH  | /api/contacts/:jid         | Update contact fields              |
| GET    | /api/contacts/:jid/messages| Messages for a contact (paginated) |
| POST   | /api/messages/send         | Send a WhatsApp message            |
| GET    | /api/labels                | List all WhatsApp Business labels  |
| GET    | /api/dashboard             | Aggregate stats for dashboard      |

### Query parameters

- `GET /api/contacts` — `?label=<label_id>`, `?sort=name|last_message|last_reply`, `?inactive_days=N`, `?search=term`
- `GET /api/contacts/:jid/messages` — `?before=timestamp`, `?limit=N` (max 200, default 50)

## WebSocket Events

The WebSocket server on port 3002 broadcasts JSON messages with `{ type, data }`.

| Event                  | Payload                              | Source    |
|------------------------|--------------------------------------|-----------|
| `message:new`          | `{ message, contact }`               | Processor |
| `contact:update`       | `{ contact }`                        | Processor |
| `history:sync:progress`| `{ processed: number }`              | Processor |
| `history:sync:done`    | `{}`                                 | Processor |
| `qr`                   | `{ data: string }`                   | WhatsApp  |
| `label:update`         | `{ labels: Label[] }`                | Processor |
| `contact:labels`       | `{ jid, labels: Label[] }`           | Processor |
| `connection:update`    | `{ connected: boolean, phone: ... }` | WhatsApp  |

## Database

SQLite at `<DATA_DIR>/crm.db` (default `./data/crm.db`). WAL mode enabled.

### contacts

| Column          | Type    | Notes                            |
|-----------------|---------|----------------------------------|
| jid             | TEXT PK | WhatsApp JID                     |
| name            | TEXT    | nullable                         |
| phone           | TEXT    | nullable                         |
| status          | TEXT    | deprecated (default `prospect`, kept for DB compat; labels are the source of truth) |
| last_message_at | INTEGER | epoch ms, nullable               |
| last_reply_at   | INTEGER | epoch ms, nullable               |
| follow_up_date  | TEXT    | ISO date string, nullable        |
| notes           | TEXT    | default `''`                     |
| created_at      | INTEGER | epoch ms                         |
| updated_at      | INTEGER | epoch ms                         |

### messages

| Column      | Type    | Notes                                        |
|-------------|---------|----------------------------------------------|
| id          | TEXT PK | UUID                                         |
| contact_jid | TEXT FK | references contacts(jid)                     |
| sender      | TEXT    | `me` or the contact's JID                    |
| content     | TEXT    |                                              |
| type        | TEXT    | `text`, `image`, `audio`, `video`, `document`|
| timestamp   | INTEGER | epoch ms                                     |

### labels

| Column       | Type    | Notes                       |
|--------------|---------|-----------------------------|
| id           | TEXT PK | WhatsApp label ID           |
| name         | TEXT    | Label display name          |
| color        | INTEGER | Color index (0-19)          |
| predefined_id| TEXT    | nullable, for predefined WA labels |
| deleted      | INTEGER | 0=active, 1=soft-deleted    |

### contact_labels

| Column      | Type    | Notes                        |
|-------------|---------|------------------------------|
| contact_jid | TEXT FK | references contacts(jid)     |
| label_id    | TEXT FK | references labels(id)        |
| (composite PK) |      | (contact_jid, label_id)      |

Indexes: `idx_messages_contact(contact_jid, timestamp)`, `idx_contacts_status(status)`, `idx_contacts_follow_up(follow_up_date)`, `idx_contact_labels_label(label_id)`.

## Key Files

### Backend (`packages/whatsapp-service/src/`)

| File              | Purpose                                       |
|-------------------|-----------------------------------------------|
| `index.ts`        | Entry point — wires DB, WA, processor, API, WS|
| `db.ts`           | Database schema, queries, CRUD                |
| `whatsapp.ts`     | Baileys connection manager                    |
| `processor.ts`    | Bridges WA events to DB, emits WS events      |
| `api.ts`          | Express router — all REST endpoints           |
| `ws.ts`           | WebSocket broadcast server                    |
| `types.ts`        | Shared TypeScript interfaces                  |
| `db.test.ts`      | Database layer tests (vitest)                 |
| `processor.test.ts`| Processor tests (vitest)                     |

### Frontend (`packages/crm-web/src/`)

| File/Dir                          | Purpose                          |
|-----------------------------------|----------------------------------|
| `app/page.tsx`                    | Dashboard (stats, follow-ups)    |
| `app/contacts/page.tsx`           | Contact list with filters        |
| `app/contacts/[jid]/page.tsx`     | Contact detail + chat            |
| `app/settings/page.tsx`           | QR pairing + connection settings |
| `app/layout.tsx`                  | Root layout with sidebar         |
| `components/sidebar.tsx`          | Navigation sidebar               |
| `components/dashboard/`           | stat-cards, follow-up-list, inactive-list |
| `components/contacts/`            | contacts-table, contacts-filters |
| `components/contact/`             | chat-messages, contact-header, contact-sidebar, message-composer |
| `components/settings/`            | connection-status, history-sync-status, qr-display |
| `hooks/useWebSocket.ts`           | WS connection hook               |
| `hooks/useDebounce.ts`            | Debounce hook                    |
| `lib/api.ts`                      | API fetch wrapper                |
| `lib/types.ts`                    | Shared TypeScript interfaces     |
| `lib/utils.ts`                    | Utility functions                |

## Environment Variables

| Variable              | Default                   | Package           |
|-----------------------|---------------------------|-------------------|
| `DATA_DIR`            | `./data`                  | whatsapp-service  |
| `API_PORT`            | `3001`                    | whatsapp-service  |
| `WS_PORT`             | `3002`                    | whatsapp-service  |
| `LOG_LEVEL`           | `info`                    | whatsapp-service  |
| `NODE_ENV`            | —                         | whatsapp-service  |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`   | crm-web           |
| `NEXT_PUBLIC_WS_URL`  | `ws://localhost:3002`     | crm-web           |
