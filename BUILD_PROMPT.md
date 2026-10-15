# Build prompt — AdLeads (everything except the live WhatsApp API)

> Paste this whole file into your coding agent (Claude Code, Cursor, etc.) from the `adleads` project root.
> It works phase by phase and stops after each phase for you to check.

---

## Your task

You are building **AdLeads**: an internal admin app + backend that turns WhatsApp enquiries from Facebook/Instagram Click-to-WhatsApp ads into leads, asks them fixed questions through a bot, assigns them a seat in a batch, gives them a personal Zoom trial link, and keeps that link active only if they pay before the trial ends.

Build **everything except the live connections to WhatsApp Cloud API, Zoom and Razorpay**. Those three sit behind adapters with a **fake** implementation now, so the whole flow runs locally end to end. Real implementations get plugged in later without touching business logic.

### Ground rules

1. **Read `AGENTS.md` first and follow it exactly.** It overrides anything here if they conflict — if they conflict, stop and tell me.
2. Read the relevant guides in `node_modules/next/dist/docs/` before writing Next.js code (this is Next 16: `proxy.ts`, not `middleware.ts`). Check installed package versions in `package.json` / `node_modules` before using an API — don't rely on memory for Prisma 7, Tailwind v4, Auth.js v5, shadcn, zod v4.
3. **Work one phase at a time.** At the end of each phase:
   - run `npm run lint`, `npx tsc --noEmit`, and `npm run build` (and tests from Phase 7 on) — all must pass,
   - give me a short summary: files created/changed, commands I need to run, anything you assumed,
   - **stop and wait for me to say "continue"**.
4. Don't add features, pages, fields or libraries that aren't listed here. If something is missing or unclear, ask — don't guess silently.
5. Never put secrets in code. All config goes through `src/lib/config.ts` (zod-validated env).
6. Keep the existing scaffold (folders in `src/modules/*`, `src/lib/*`, `prisma/`). Fill in files; don't reorganise.

### Environment

- WSL (Ubuntu), Node 20+, npm.
- PostgreSQL 16 locally. Create `docker-compose.yml` with a `postgres:16` service (db `adleads`, user/password `adleads`, port 5432, named volume). If Docker isn't available, tell me the `apt` alternative instead.
- `DATABASE_URL=postgresql://adleads:adleads@localhost:5432/adleads`

---

## Phase 0 — Tooling

- Confirm `src/` layout and `"@/*": ["./src/*"]` in `tsconfig.json`. Turn on `"strict": true` if not already.
- Install and configure **Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/postcss`, `postcss.config.mjs`).
- `npx shadcn@latest init`, then set `components.json` aliases so:
  - primitives go to `@/modules/core/components/ui`
  - `cn()` lives in `@/modules/core/utils/cn.ts`
- Add shadcn components: `button input label textarea select checkbox switch table badge card dialog alert-dialog dropdown-menu tabs sonner skeleton separator tooltip popover calendar sheet avatar`.
- Install: `lucide-react`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `date-fns-tz`, `bcryptjs`, `@types/bcryptjs`, `@tanstack/react-table`, `vitest`, `prettier`, `prettier-plugin-tailwindcss`.
- `.prettierrc` with the Tailwind plugin; add `"format"`, `"test"`, `"db:migrate"`, `"db:seed"`, `"db:studio"` npm scripts.
- ESLint: add `no-restricted-imports` so files outside `src/modules/core` can't import from `@/modules/core/components/ui/*` directly except through `@/modules/core/components` re-exports, and so nothing outside a module imports `@/modules/<name>/(services|components|hooks|utils)/*`.
- Delete the starter welcome page content and `page.module.css`. `src/app/page.tsx` redirects to `/dashboard`.

**Done when:** dev server starts, `/` redirects, lint/tsc/build pass.

---

## Phase 1 — Design tokens + UI kit

### Tokens (`src/app/globals.css`) — the only CSS in the app

Light theme only for v1. Semantic tokens mapped into Tailwind with `@theme inline`:

| Token | Value |
| --- | --- |
| `--background` | `#ffffff` |
| `--foreground` | `#0f172a` |
| `--card` / `--card-foreground` | `#ffffff` / `#0f172a` |
| `--primary` / `--primary-foreground` | `#0f766e` / `#ffffff` |
| `--muted` / `--muted-foreground` | `#f1f5f9` / `#64748b` |
| `--accent` / `--accent-foreground` | `#f1f5f9` / `#0f172a` |
| `--border` / `--input` / `--ring` | `#e2e8f0` / `#e2e8f0` / `#0f766e` |
| `--success` | `#16a34a` |
| `--warning` | `#d97706` |
| `--danger` (also shadcn `--destructive`) | `#dc2626` |
| `--radius` | `0.5rem` |

Font: Inter via `next/font/google`, exposed as `--font-sans`.

### Core components (`src/modules/core/components/`, all re-exported from its `index.ts`)

| Component | Props / behaviour |
| --- | --- |
| `AdminShell` | Sidebar (logo, nav, user menu with sign-out) + top bar + content area. Owns page padding (`p-6`) and max width (`max-w-7xl`). Sidebar collapses to a `Sheet` below `lg`. Nav: Dashboard, Leads, Inbox (with unread count badge), Batches, Enrollments, Payments, Bot script, Settings. Hide items by role. |
| `PageHeader` | `title`, `description?`, `actions?`, `backHref?` |
| `FilterBar` | Children in a wrapping row; search input first. Syncs filters to URL search params via a `useQueryState`-style hook in `core/hooks`. |
| `DataTable<T>` | TanStack Table. `columns`, `data`, `total`, `page`, `pageSize`, `onRowHref?(row)`, `emptyState`, `isLoading`. Server-side pagination via URL params. Skeleton rows when loading. |
| `EmptyState` | `icon`, `title`, `description?`, `action?` |
| `StatusBadge` | `status` → label + tone. The ONLY place status colours live. Covers all lead, enrollment, payment, batch and message statuses (see Phase 2 enums). Tones: neutral (muted), info (primary/10), success, warning, danger. |
| `Money` | `paise: number` → `₹2,999.00` (en-IN grouping) |
| `DateTime` | `value: Date \| string`, `relative?: boolean` → IST, `14 Oct 2026, 4:30 PM` or `2 h ago` |
| `Phone` | `e164` → `+91 98123 45678`, with copy button |
| `FormField` | Label (with `*` if required), control slot, help text, error. Works with react-hook-form. |
| `ConfirmDialog` | `title`, `description`, `confirmLabel`, `tone: 'default' \| 'danger'`, `onConfirm` (async, shows pending state) |
| `StatTile` | `label`, `value`, `hint?` |
| `SectionCard` | `Card` with `title`, `description?`, `actions?` |
| `KeyValueList` | Label/value rows for detail pages |

Also: `Toaster` (sonner) mounted once in the root layout; a `toast` helper re-exported from core.

### `/dev/ui` page

Visible only when `NODE_ENV !== 'production'`. Shows every token swatch, every core component, every `StatusBadge` value, a sample list page and a sample form page built from the recipes in `AGENTS.md`.

**Done when:** `/dev/ui` renders everything, no hex colours outside `globals.css`, lint/tsc/build pass.

---

## Phase 2 — Database (Prisma 7 + PostgreSQL)

Use the `prisma-client` generator (output `src/generated/prisma`) and the `@prisma/adapter-pg` driver adapter as already set up in `prisma.config.ts`. Prisma models in PascalCase, fields camelCase, mapped to snake_case tables/columns with `@@map` / `@map`. Every model has `createdAt` and `updatedAt`. IDs are `uuid` unless stated. Money is `Int` paise.

### Enums

- `LeadStatus`: NEW, ASKING, QUALIFIED, WAITLISTED, TRIAL_ACTIVE, PAYMENT_PENDING, ENROLLED, EXPIRED, DROPPED, OPTED_OUT, CANCELLED
- `LeadSource`: CTWA_AD, LEAD_FORM, ORGANIC, MANUAL
- `BatchStatus`: OPEN, FULL, CLOSED
- `EnrollmentStatus`: TRIAL, PAID, EXPIRED, CANCELLED
- `PaymentMethod`: RAZORPAY, CASH, BANK, UPI_MANUAL
- `PaymentStatus`: CREATED, PAID, EXPIRED, REFUNDED, FAILED
- `MessageDirection`: IN, OUT · `MessageType`: TEXT, INTERACTIVE, TEMPLATE, MEDIA · `MessageStatus`: QUEUED, SENT, DELIVERED, READ, FAILED
- `QuestionInput`: TEXT, BUTTONS, LIST · `OptionsSource`: STATIC, COURSES, BATCHES
- `WebhookProvider`: META, RAZORPAY, ZOOM · `JobStatus`: PENDING, RUNNING, DONE, FAILED
- `Role`: ADMIN, SALES, VIEWER

### Models

- **Course**: name (≤100), description (≤72, WhatsApp list limit), feePaise, trialDays (nullable → setting default), isActive, sortOrder.
- **Batch**: courseId, name, daysOfWeek `Int[]` (1=Mon…7=Sun), startTime / endTime (`HH:mm` strings, IST), startDate, endDate, capacity, seatsTaken (default 0), zoomMeetingId (nullable BigInt), zoomHostUser (nullable), status `BatchStatus`. Index (courseId, status).
- **Lead**: phoneE164 (unique), waId, name, profileName, courseId?, status (default NEW), currentStep?, needsHuman (default false), source, adId?, adName?, campaignId?, ctwaClid?, lastInboundAt?, freeWindowUntil?, remindersSent (default 0), optedOutAt?, assignedToId? (→ User), notes?. Indexes on status, createdAt, needsHuman.
- **LeadEvent**: id BigInt autoincrement, leadId, fromStatus?, toStatus, actor (string: `bot` / `cron` / `webhook` / user id), note?.
- **Question**: step (unique), key (`name` / `course` / `batch` / `confirm`), prompt, inputType, optionsSource, validationRegex?, isActive.
- **QuestionOption**: questionId, value (≤24), label (≤24), sortOrder.
- **Answer**: leadId, questionKey, answerValue, answerLabel, answeredAt. Unique (leadId, questionKey).
- **Enrollment**: leadId, batchId, status, trialStart, trialEnd (dates), zoomRegistrantId?, zoomJoinUrl?, linkSentAt?, paidAt?, cancelledAt?, cancelReason?. Unique (leadId, batchId).
- **Payment**: enrollmentId, amountPaise, method, razorpayLinkId?, razorpayLinkUrl?, razorpayPaymentId? (unique), status, linkExpiresAt?, paidAt?, recordedById? (→ User).
- **Message**: leadId, direction, waMessageId (unique, nullable for queued), type, templateName?, body (Json), status, errorCode?, sentBy (string).
- **WebhookEvent**: id BigInt autoincrement, provider, eventKey (unique), payload Json, processedAt?, error?.
- **Job**: id BigInt autoincrement, type, payload Json, runAt, attempts (default 0), status (default PENDING), lastError?. Index (status, runAt).
- **User**: name, email (unique), passwordHash, role, isActive.
- **Setting**: key (PK string), value Json. Keys: `default_trial_days` (3), `reminder_days_before` (2), `payment_link_expiry_hours` (72), `welcome_text`, `nudge_after_hours` ([3, 22]).

### Seed (`prisma/seed.ts`, idempotent)

- Admin user from env `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; one SALES user.
- 2 courses, 4 batches (one nearly full, one FULL).
- The 4 bot questions (name → course → batch → confirm) with prompts from the "Bot" section below.
- All settings keys.
- ~25 sample leads spread across every status, with answers, enrollments, payments and a few messages, so every admin screen has data.

**Done when:** `npm run db:migrate` + `npm run db:seed` work on a fresh DB, `npx prisma studio` shows the data.

---

## Phase 3 — Config, auth, roles

- `src/lib/config.ts`: zod schema for all env vars (see `.env.example`), parsed once, typed export. Add `INTEGRATIONS_MODE` = `fake | live` (default `fake`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- `src/lib/db.ts`: Prisma singleton with the pg adapter.
- `src/lib/auth.ts`: Auth.js v5, Credentials provider (email + bcrypt password), JWT session carrying `id`, `name`, `role`. Inactive users can't sign in.
- `src/proxy.ts`: protects everything except `/login`, `/api/webhooks/*`, `/api/cron/*`, static assets.
- `modules/auth`: `requireUser()`, `requireRole(...roles)` for server components, server actions and API routes. VIEWER is read-only everywhere; SALES can act on leads, enrollments and payments; only ADMIN manages courses, batches, bot script, settings, users.
- `/login` page per `AGENTS.md` recipes (centred card, `FormField`s, error toast).

**Done when:** I can log in as the seeded admin, `/dashboard` loads in `AdminShell`, a VIEWER can't reach Settings or trigger actions.

---

## Phase 4 — Integration adapters (fake now, live later)

Each adapter is an interface with `fake` and `live` implementations, chosen by `config.INTEGRATIONS_MODE`. **Only the fake ones are implemented now.** The live ones are files that throw `Error('Not implemented: live <name> adapter')` with a TODO comment listing the real API calls.

- `src/lib/whatsapp/`
  - `WhatsAppClient` interface: `sendText`, `sendButtons` (≤3 buttons, title ≤20), `sendList` (≤10 rows, title ≤24, description ≤72), `sendTemplate(name, lang, params)`. Each returns `{ waMessageId }`.
  - Fake: validates WhatsApp limits (throw on violation), returns `wamid.fake.<uuid>`, no network.
  - `verify.ts`: real `X-Hub-Signature-256` HMAC verification (it's pure code — implement it fully).
- `src/lib/zoom/`: `ZoomClient` with `addRegistrant(meetingId, {firstName, lastName, email})` → `{ registrantId, joinUrl }` and `cancelRegistrant(meetingId, registrantId)`. Fake returns `https://zoom.example/j/<meetingId>?tk=<uuid>` and records cancels in memory/log.
- `src/lib/razorpay/`: `RazorpayClient` with `createPaymentLink({amountPaise, referenceId, customer, expireBy})` → `{ id, shortUrl }`, plus real `verifyWebhookSignature` (pure HMAC — implement fully). Fake returns `plink_fake_<id>` and a URL to `/dev/pay/<id>` (see Phase 5).

**Done when:** unit tests cover WhatsApp limit validation and both signature verifiers.

---

## Phase 5 — Domain services + bot + dev simulators

Implement module services per `AGENTS.md` backend rules. Every service file starts with `import 'server-only';`. Expose through each module's `index.ts`.

### core utils
`phone.ts` (normalise Indian numbers to E.164, format for display), `money.ts`, `dates.ts` (IST helpers, `addTrialDays`, `isWithin24h`), `cn.ts`.

### leads
- `upsertLead(inbound)`: find/create by phone; on first message store referral (adId, ctwaClid, headline) and set `source = CTWA_AD`, `freeWindowUntil = now + 72h`; always update `lastInboundAt`.
- `transition(leadId, toStatus, { actor, note })`: enforce an explicit allowed-transitions map (from the statuses table below), write `LeadEvent`, throw on illegal transitions. The **only** writer of `lead.status`.
- `queries.ts`: paginated list with filters (search name/phone, status, course, batch, source, date range, needsHuman), detail (lead + answers + enrollments + payments + events + messages), inbox list, counts for nav badge.

| Status | Moves to |
| --- | --- |
| NEW | ASKING, OPTED_OUT |
| ASKING | QUALIFIED, DROPPED, OPTED_OUT |
| DROPPED | ASKING, OPTED_OUT |
| QUALIFIED | TRIAL_ACTIVE, WAITLISTED |
| WAITLISTED | TRIAL_ACTIVE, OPTED_OUT, CANCELLED |
| TRIAL_ACTIVE | PAYMENT_PENDING, ENROLLED, CANCELLED |
| PAYMENT_PENDING | ENROLLED, EXPIRED, CANCELLED |
| EXPIRED | ENROLLED, CANCELLED |
| ENROLLED | CANCELLED |
| OPTED_OUT, CANCELLED | (terminal) |

### messaging
- `send.ts`: `sendText / sendButtons / sendList / sendTemplate(leadId, …)`. Checks opt-out (never send), checks the 24-hour window (`lastInboundAt`) — outside it, free-form sends throw `OutsideWindowError` so callers must use a template. Writes a `Message` row (QUEUED → SENT with `waMessageId`, or FAILED with error). Uses the WhatsApp adapter.
- `parseWebhook.ts`: real Meta webhook JSON → `InboundMessage[]` (text, button_reply, list_reply, referral, statuses). Loops over all entries/changes/messages/statuses. Store sample payloads in `tests/fixtures/meta/`.
- `constants/templates.ts`: `class_reminder`, `trial_payment_reminder`, `trial_last_day`, `enrollment_confirmed`, `trial_ended`, `waitlist_seat_open` with typed param builders.

### bot
- `engine.ts` → `handleInbound(msg)`: dedupe by `waMessageId` → `upsertLead` → save inbound `Message` → keywords (`STOP` → OPTED_OUT, `HELP`/`AGENT` → needsHuman, `RESTART` → step 1) → route by status + `currentStep` → step `handle()` → next step `ask()` or finish.
- Steps (`BotStep` interface in `bot/types`), prompts loaded from `Question` rows:
  1. **welcome + name** — free text, 2–60 chars, letters/spaces; saves `lead.name`.
  2. **course** — list message of active courses.
  3. **batch** — list of that course's batches with free seats, row description = `"<days> · <time> · N seats left"`. No free batch → WAITLISTED + waitlist message.
  4. **confirm** — summary + buttons `Confirm` / `Change` (Change → back to course).
- On Confirm: `transition → QUALIFIED` → `enrollments.assignSeat()`.
- Unknown input at a button/list step → re-ask once with a hint; second time → set `needsHuman`.
- Messages in other statuses (e.g. TRIAL_ACTIVE) → short contextual reply ("Your trial link: …", "Your payment link: …") or `needsHuman` for free text.

### batches
CRUD; `status` auto-flips OPEN ↔ FULL from `seatsTaken` vs `capacity`; CLOSED is manual. On create, call the Zoom adapter to "create meeting" (fake: generate an id). Block overlapping batches on the same `zoomHostUser`.

### enrollments
- `assignSeat(leadId, batchId)`: one transaction — lock the batch row (`SELECT … FOR UPDATE` via `$queryRaw`), check capacity, create `Enrollment` (TRIAL, trialStart today, trialEnd = start + trial days), increment `seatsTaken`, `transition → TRIAL_ACTIVE`. Then enqueue `ZOOM_REGISTER` job. Full → WAITLISTED.
- `sendTrialLink(enrollmentId)` (job handler): Zoom `addRegistrant` → save registrant id + join URL → WhatsApp trial confirmation (free-form if in window, else template).
- `extendTrial`, `moveBatch` (frees old seat, takes new one, re-registers), `cancel(reason)` (Zoom cancel first, then CANCELLED, free seat), `expire(enrollmentId)` (Zoom cancel → EXPIRED → free seat → `trial_ended` template → offer seat to first WAITLISTED lead for that batch).

### payments
- `requestPayment(enrollmentId)`: create Razorpay link (expiry from settings), `Payment` CREATED, `transition → PAYMENT_PENDING`, send `trial_payment_reminder` template.
- `markPaid({ paymentId | enrollmentId, method, razorpayPaymentId?, recordedById? })`: the single path to ENROLLED. Idempotent on `razorpayPaymentId`. Amount must match course fee, otherwise set `needsHuman` and don't enroll. If the enrollment had EXPIRED, re-register on Zoom (new link). Sends `enrollment_confirmed`.
- `handleRazorpayEvent(payload)`: `payment_link.paid` → `markPaid`; `payment_link.expired` → Payment EXPIRED; `refund.processed` → `enrollments.cancel`.
- `recordManualPayment` for CASH / BANK / UPI_MANUAL → `markPaid`.

### jobs
`enqueue(type, payload, runAt?)`, `runner.runDue(limit)` (claim with `FOR UPDATE SKIP LOCKED`, max 5 attempts, exponential backoff, mark FAILED + set `needsHuman` on the lead after the last attempt). Handlers: `processWebhook`, `sendMessage`, `zoomRegister`, `zoomCancel`, `createPaymentLink`.

### Dev simulators (only when `NODE_ENV !== 'production'`)

- **`/dev/whatsapp`** — a phone-style chat UI built from core components:
  - pick or type a phone number + profile name, optional "came from ad" toggle (adds a referral block),
  - type text or tap the bot's buttons/list rows,
  - each action builds a **real Meta-shaped webhook payload** and POSTs it to `/api/dev/whatsapp-inbound`, which runs exactly what the real webhook will: store `WebhookEvent` → enqueue `processWebhook` → run the job immediately in dev,
  - shows outbound bot messages from the `Message` table (polling every 2 s), rendering buttons and lists so they can be tapped.
- **`/dev/pay/[linkId]`** — fake Razorpay checkout page with "Pay" and "Fail" buttons that POST a Razorpay-shaped event (correctly signed with `RAZORPAY_WEBHOOK_SECRET`) to `/api/webhooks/razorpay`.
- **`/dev/clock`** — buttons to run each cron route now, and a "shift time by N days" option for testing trial expiry (implemented via a `DEV_NOW_OFFSET_DAYS` setting read by `dates.ts` in dev only).

**Done when:** in `/dev/whatsapp` I can go from "Hi" → name → course → batch → confirm → receive a fake Zoom link; then pay via `/dev/pay` and see ENROLLED; or shift the clock and see EXPIRED with the registrant cancelled — all reflected in the admin screens.

---

## Phase 6 — Admin screens

Every page follows the list or detail recipe in `AGENTS.md`, uses only core components, and handles loading (`loading.tsx` with skeletons), empty and error (`error.tsx`) states. Mutations are server actions that call module services and return `{ ok, error }` → toast.

| Route | Content | Actions (role) |
| --- | --- | --- |
| `/dashboard` | StatTiles: leads today / 7 days, active trials, trial→paid % (30 days), revenue this month. Funnel counts by status. Batches table with seats left. Leads by ad (adName, leads, enrolled, conversion %). Date-range filter. | — |
| `/leads` | List: name, phone, course, batch, status, source/ad, last message, needs-human badge. Filters: search → status → course/batch → date range, plus source + needs human. | Export CSV (SALES+), bulk assign to staff (SALES+) |
| `/leads/[id]` | Main (2/3): chat thread (Message rows, newest at bottom) + reply box. Side (1/3): profile (`KeyValueList`), answers, enrollment card (batch, trial dates, Zoom link, status), payments, status timeline (LeadEvents), notes. | Send reply (blocked with explanation outside 24h; offer template picker instead), change status (only legal transitions shown), assign batch, resend trial link, request payment, mark needs-human resolved, edit notes (SALES+) |
| `/inbox` | Leads with `needsHuman` or unread inbound, newest first; relative times. "Assigned to me / all" tabs. | Open, resolve (SALES+) |
| `/batches` | List with SeatMeter (taken/capacity), status, days/time, course. | Create/edit/close (ADMIN) |
| `/batches/[id]` | Batch details + enrolled students table. | Edit, close (ADMIN) |
| `/enrollments` | List: student, batch, trial start/end, days left, status, paid date. Filter "trial ending in N days". | Extend trial, move batch, cancel, request payment (SALES+) |
| `/payments` | List: student, amount, method, status, Razorpay ids, date. | Record manual payment, resend link, mark refunded (SALES+) |
| `/script` | Bot questions in order; edit prompt text, static options, active flag. Courses CRUD on a second tab. | ADMIN |
| `/settings` | Tabs: General (settings keys with typed inputs), Users (list, add, deactivate, change role). | ADMIN |

All destructive actions use `ConfirmDialog` naming the exact lead/batch affected.

**Done when:** every route works against seeded data for all three roles, and the `/dev/whatsapp` flow is visible live in `/leads/[id]` and `/inbox`.

---

## Phase 7 — API routes, cron, tests

### Route handlers (thin: auth/verify → call service → respond)

- `/api/webhooks/whatsapp` — GET: verify-token handshake. POST: verify signature → store `WebhookEvent` (eventKey = message/status id) → enqueue `processWebhook` → 200 immediately. Fully implemented and tested with fixtures; it simply won't receive real traffic until the Meta app is connected.
- `/api/webhooks/razorpay` — POST: verify signature → store → enqueue → 200.
- `/api/webhooks/leadgen` — return 501 for now with a TODO.
- `/api/cron/jobs` (every minute), `/api/cron/nudges` (every 30 min: re-ask pending question at 3 h and 22 h, DROPPED after 24 h), `/api/cron/trials` (daily 09:00 IST: class reminder day before first class, `requestPayment` at trialEnd − 2 days, last-day reminder), `/api/cron/expire` (daily 23:30 IST: expire unpaid trials past trialEnd). All require header `x-cron-secret`.
- `/api/admin/*` only where a client component needs it (CSV export, chat polling); otherwise prefer server actions.

### Tests (vitest, against a separate test database)

- `transition`: every legal and illegal move.
- `assignSeat`: two concurrent calls for the last seat → exactly one TRIAL, one WAITLISTED.
- Bot engine: replay fixtures for the full happy path, invalid name, "Change" loop, STOP, no seats.
- `markPaid`: idempotent on duplicate webhook; amount mismatch → needsHuman; paid after EXPIRED → re-registered.
- `expire`: registrant cancelled, seat freed, waitlisted lead offered the seat.
- `parseWebhook` + signature verifiers.

**Done when:** all tests pass, `crontab.txt` matches the routes, and a `README.md` section explains: start Postgres, migrate, seed, run dev, use `/dev/whatsapp`, `/dev/pay`, `/dev/clock`.

---

## Out of scope for now (do NOT build)

- Live WhatsApp Cloud API sending, Meta app setup, template submission.
- Live Zoom and Razorpay API calls (adapters only).
- Facebook Lead Form ingestion (route stub only).
- Dark mode, i18n, multi-tenant, AI/free-text understanding, mobile app.

When the live adapters are added later, switching `INTEGRATIONS_MODE=live` must be the only change outside `src/lib/{whatsapp,zoom,razorpay}`.
