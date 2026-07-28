# WhatsApp Business Admin — Design Spec

Date: 2026-07-24
Status: Approved

## Overview

A self-hosted admin application for the **Meta WhatsApp Business Cloud API** (Graph API).
It is a full inbox product: manage message **Templates**, run a two-way **Inbox**, send
messages and **Broadcasts**, receive **Webhooks**, manage **Contacts**, and keep a complete
audit **Log** of every API request/response and inbound webhook.

Single WhatsApp Business Account (WABA) per deployment. Multi-user (Admin / Agent).

## Stack

- **Next.js (App Router, TypeScript)** under a **custom Node server** (`server.ts`) so a `ws`
  WebSocket server can share the same HTTP port as the Next handler.
- **PostgreSQL + Prisma** ORM.
- **Tailwind + shadcn/ui**, dense admin layout (compact tables, sidebar nav).
- **TanStack Query** for client data; **react-hook-form + zod** for forms/validation.
- **Auth.js (NextAuth)** credentials provider + Prisma adapter; JWT session with role.
- **AES-256-GCM** encryption for the WhatsApp access token at rest (key from env).
- **Docker Compose** (app + Postgres). Webhook requires public HTTPS (ngrok dev / proxy prod).

## Core design choice: `graphFetch()` wrapper

Every outbound Graph API call goes through one wrapper that automatically writes an `ApiLog`
row (endpoint, request body, response, status, duration). This makes "store every request and
response" automatic and impossible to forget.

## Modules

| Module | Access | Purpose |
|---|---|---|
| Auth & Users | Admin manages | Login, Admin/Agent roles, user CRUD |
| Settings | Admin | WABA ID, phone number ID, encrypted access token, app secret, webhook verify token, API version, Test connection |
| Templates | Admin | Wizard create, list + status, live preview, submit to Meta, sync, delete |
| Contacts | Admin/Agent | name, wa_id (phone), tags, notes; auto-created on inbound |
| Inbox | Admin/Agent | conversation threads, send text/media, 24h-window enforcement, realtime |
| Broadcasts | Admin | pick approved template → send to a contact segment; per-recipient status |
| Logs | Admin | browse every outbound API call + every inbound webhook, filterable |

## Template Wizard (user-friendly)

6-step wizard with a live WhatsApp-style phone preview pinned right, updating as you type:

1. **Category & basics** — Marketing / Utility / Authentication (plain-language help), name
   (auto lowercase/underscore), language.
2. **Header** — None / Text / Image / Video / Document (sample upload for media).
3. **Body** — text with "Insert variable"; each `{{n}}` gets a friendly sample value field.
4. **Footer** — optional short text.
5. **Buttons** — Quick Reply and CTA (URL / Phone / Copy Code); per-type limits enforced.
6. **Review & Submit** — full preview + inline validation mirroring Meta rules → submit to Graph API.

Preview renders real bubble (header media, bold/italic, buttons) using sample values.

## Data Model (Prisma, key tables)

- `User(id, email, passwordHash, role[ADMIN|AGENT], name, createdAt)`
- `WabaSettings` (singleton): `wabaId, phoneNumberId, phoneNumberDisplay, accessTokenEnc,
  appSecret, webhookVerifyToken, apiVersion`
- `Template(id, name, language, category, status[LOCAL|PENDING|APPROVED|REJECTED|PAUSED|DISABLED],
  components JSONB, metaTemplateId, rejectionReason, createdById, timestamps)`
- `Contact(id, waId, name, profileName, tags, notes, lastInboundAt, createdAt)`
- `Conversation(id, contactId, lastMessageAt, lastInboundAt, unreadCount, status[OPEN|CLOSED],
  assignedUserId)`
- `Message(id, conversationId, direction[IN|OUT], waMessageId, type, text, mediaPath, mimeType,
  caption, templateId?, status[SENT|DELIVERED|READ|FAILED], errorJson, sentById?, timestamp)`
- `Broadcast(id, name, templateId, status, totals..., createdById, createdAt)`
- `BroadcastRecipient(id, broadcastId, contactId, status, waMessageId, error)`
- `ApiLog(id, direction[OUTBOUND], method, endpoint, requestBody, responseStatus, responseBody,
  durationMs, relatedType, relatedId, createdAt)`
- `WebhookEvent(id, payload JSONB, signatureValid, processedOk, error, createdAt)`

## Webhooks & Realtime

- `GET /api/webhook` — verification handshake (`hub.challenge`).
- `POST /api/webhook` — verify `X-Hub-Signature-256` vs app secret, **store raw payload first**,
  then process: inbound messages (download media, upsert contact/conversation/message),
  delivery statuses, template status updates. Then broadcast to WS clients.
- WS server attached to the custom Node server; rooms per conversation + a global feed.

## Media, Sending & Background Work

- **Media store:** local filesystem (`./storage/media`), path in DB, streamed via authenticated
  route. Behind a `MediaStore` interface (S3 swappable later).
- **24h window:** inside 24h of last inbound → free-form allowed; outside → template required.
  Enforced client + server side.
- **Broadcasts:** in-process queue (`p-queue`) respecting rate limits; per-recipient status
  updated from webhooks. (BullMQ+Redis only if outgrowing one process.)

## Error Handling & Testing

- Central Graph error normalization; failed sends persist error; webhooks always store raw
  payload even if processing throws.
- **Vitest** unit tests for: template validation, webhook signature verification, `graphFetch`
  auto-logging, 24h-window logic. Seed script for local dev.

## Decisions made (not asked)

- In-process queue for broadcasts (not Redis).
- Local filesystem for media (not S3).
Both swappable later.
