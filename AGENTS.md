<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AdLeads — rules for contributors and coding agents

Read this whole file before writing code. If a rule blocks you, stop and say so — don't work around it.

## What this app is

- Facebook/Instagram Click-to-WhatsApp ad → WhatsApp bot asks fixed questions → lead saved → seat assigned in a batch → personal Zoom trial link → Razorpay payment keeps the link active; unpaid trials expire and the Zoom registrant is cancelled.
- Users of the admin panel are internal staff (roles: `ADMIN`, `SALES`, `VIEWER`). Optimise for clarity and speed, not marketing visuals.
- Stack: Next.js (App Router, `src/`), TypeScript strict, Tailwind CSS v4, shadcn/ui, Prisma 7 + PostgreSQL, Auth.js, WhatsApp Cloud API, Razorpay, Zoom.

## Folder structure

```
src/
  app/        routes only: pages, layouts, route handlers — no business logic
  lib/        thin clients + config: db, auth, whatsapp, zoom, razorpay
  modules/
    core/     shared UI kit, hooks, types, utils (used by every module)
    <feature>/  components/ hooks/ services/ types/ constants/ utils/ index.ts
  proxy.ts    auth guard (Next 16 name for middleware)
```

- Feature modules: `auth`, `messaging`, `bot`, `leads`, `batches`, `enrollments`, `payments`, `jobs`, `dashboard`, `settings`.
- Import a module only through its `index.ts`: `import { markPaid } from '@/modules/payments'` ✅ — `@/modules/payments/services/markPaid` ❌ (except inside that module).
- Allowed dependency direction: `app → modules → core / lib`. Modules may call each other only as: `bot → leads, enrollments, messaging, settings` · `enrollments → leads, messaging, jobs, settings` · `payments → enrollments, leads, messaging, settings`. `leads`, `messaging`, `jobs`, `settings` import no other feature module. Nothing imports from `bot`.
- `auth` (`requireUser`, `requireRole`, `guarded`) is cross-cutting like `core`: any module may import it.
- `jobs` is a generic queue + runner. The job type → handler map lives in the app layer (`src/app/_jobs/handlers.ts`), which may import any module.
- New feature = new folder in `modules/`, never new top-level folders in `src/`.

## UI rules (keep the app consistent)

### Use the kit, never build one-offs

- All UI comes from `@/modules/core/components` (shadcn/ui primitives live in `@/modules/core/components/ui`).
- Do NOT write raw `<button>`, `<input>`, `<select>`, `<table>` with ad-hoc classes in pages or feature components. Use `Button`, `Input`, `Select`, `DataTable`, etc.
- Need something the kit lacks? Add it to `modules/core/components/` first (generic, documented props), then use it. Never copy-paste a component into a feature module and tweak it.
- Feature components (e.g. `LeadsTable`) compose core components; they don't restyle them.

### Tokens only

- Colours: semantic tokens only — `background`, `foreground`, `primary`, `muted`, `muted-foreground`, `border`, `success`, `warning`, `danger`.
  - ✅ `bg-primary text-primary-foreground`, `text-muted-foreground`, `border-border`
  - ❌ hex codes, `rgb()`, `bg-blue-600`, `text-gray-500`, or any palette colour
- No inline `style={{…}}`. No new `.css` / `.module.css` files. Only `src/app/globals.css` holds CSS, and only token definitions live there.
- Changing the brand look = edit tokens in `globals.css`, nothing else.

### Spacing, type, shape

- Spacing scale only: `1, 2, 3, 4, 6, 8, 12` (Tailwind units). No arbitrary values like `p-[13px]` or `mt-[7px]`.
- Page padding and max width come from `AdminShell` — pages never set their own outer padding.
- Text sizes: page title `text-2xl font-semibold`, section title `text-lg font-semibold`, body `text-sm`, helper/meta `text-xs text-muted-foreground`. No other sizes.
- Corners: `rounded-lg` (from `--radius`) for cards, inputs, buttons, dialogs. Badges `rounded-full`.
- Font: the app font from `globals.css` only. No other font imports.
- Icons: `lucide-react` only, `size-4` inline with text, `size-5` in buttons-with-icon-only. No other icon packages, no emoji as icons.

### Page recipes (every page is one of these)

**List page** — Leads, Batches, Enrollments, Payments, Inbox:

```tsx
<PageHeader title="Leads" description="Everyone who messaged from an ad" actions={<Button>Export CSV</Button>} />
<FilterBar>…search + filters…</FilterBar>
<DataTable columns={columns} data={rows} emptyState={<EmptyState … />} />
```

- Filters always in this order: search → status → course/batch → date range.
- Row click opens the detail page. Row actions go in a `DropdownMenu` (⋯) in the last column.
- Use `Skeleton` rows while loading, `EmptyState` when there's no data — never a blank area or a bare "No data".

**Detail / form page** — Lead detail, Batch form, Settings:

- `PageHeader` with primary action on the right (max one primary `Button`; others `variant="outline"` or in a menu).
- Content in `Card`s on a 2/3 + 1/3 grid (`lg:grid-cols-3`, main `lg:col-span-2`). Single column below `lg`.
- Forms: `FormField` (label + control + help + error) with zod schemas shared with the server action / API. Labels above inputs, required fields marked with `*`.
- Submit button bottom-right of the form, disabled + spinner while pending.

### Status, money, dates — one renderer each

- Lead/enrollment/payment statuses: always `<StatusBadge status={…} />`. Never colour a status inline. New status → add it to the map in `StatusBadge` only.
- Money: always `<Money paise={…} />` → `₹2,999.00`. Amounts are stored in paise (integers) everywhere.
- Dates: always `<DateTime value={…} />` in IST (`Asia/Kolkata`). Format `14 Oct 2026, 4:30 PM`. Relative ("2 h ago") only in chat threads and inbox.
- Phone numbers: display as `+91 98123 45678` via `formatPhone()` from `@/modules/core/utils`.

### Feedback and destructive actions

- Success/failure after an action → toast (`sonner`) only. No `alert()`, no inline success banners.
- Destructive or irreversible actions (cancel enrollment, mark refunded, deactivate user, close batch) → `ConfirmDialog` that names the exact thing affected ("Cancel Rahul Sharma's enrollment in Morning Mon–Fri? Their Zoom link will stop working.").
- Errors shown to staff are plain language + what to do next. Never show raw error objects or stack traces.

### Accessibility basics

- Every input has a visible label. Icon-only buttons have `aria-label`.
- Don't rely on colour alone: `StatusBadge` always shows the status text.
- Interactive elements must be reachable and usable by keyboard (shadcn defaults — don't override focus styles).

### Wording

- English, sentence case for titles and buttons ("Add batch", not "Add Batch" or "ADD BATCH").
- Buttons are verbs: "Save changes", "Send reply", "Mark paid". Not "OK" / "Submit".
- Use the same nouns everywhere: **lead**, **batch**, **enrollment**, **trial**, **payment**. Not "student/customer/enquiry" interchangeably.

## Backend rules (don't break these)

- Lead status changes ONLY via `transition()` in `@/modules/leads` (writes `lead_events`). Never `update({ status })` directly.
- `ENROLLED` is reached ONLY via `markPaid()` in `@/modules/payments` — both Razorpay webhook and manual "Mark paid" call it.
- Every outgoing WhatsApp message goes through `send.ts` in `@/modules/messaging` (it checks the 24-hour window and logs to `messages`). Never call `lib/whatsapp/client.ts` from anywhere else.
- Webhook route handlers: verify signature → store raw event in `webhook_events` → return 200 → enqueue a job. No Zoom/Razorpay/WhatsApp calls inside the request.
- Seat assignment uses the locked transaction in `assignSeat()`. Never increment `seats_taken` anywhere else.
- Every file in `services/` starts with `import 'server-only';`. Secrets come from `@/lib/config`, never `process.env` directly in modules, never in client components.
- Deduplicate by `wa_message_id`, `razorpay_payment_id`, and `webhook_events.event_key` — assume every webhook can arrive twice.
- Phone numbers stored as E.164 (`+919812345678`). Money in paise. Times in UTC in the DB, shown in IST.

## Code style

- TypeScript strict; no `any` (use `unknown` + zod parse at boundaries).
- Server Components by default; add `'use client'` only for interactivity, as low in the tree as possible.
- Data mutations via server actions or `/api/admin/*` routes that call module services — no Prisma calls in components or pages directly except read-only queries through module `services/queries.ts`.
- File names: components `PascalCase.tsx`, everything else `camelCase.ts`. Linux is case-sensitive — import paths must match exactly.
- Prettier with `prettier-plugin-tailwindcss` formats class order; don't fight it.

## Before you finish a change

- [ ] Used only `@/modules/core/components` for UI; no hex colours, inline styles or new CSS files.
- [ ] New page follows the list or detail recipe above.
- [ ] Statuses/money/dates use `StatusBadge` / `Money` / `DateTime`.
- [ ] Loading, empty and error states all handled.
- [ ] Destructive actions use `ConfirmDialog`.
- [ ] Backend rules above respected (status via `transition`, sends via `send.ts`, webhooks fast + idempotent).
- [ ] `npm run lint` and `npx tsc --noEmit` pass.
- [ ] If you added a core component or token, it's shown on `/dev/ui`.

<!-- END:nextjs-agent-rules -->
