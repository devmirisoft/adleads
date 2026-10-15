# AdLeads

Click-to-WhatsApp ad → WhatsApp bot asks a few questions → lead gets a seat in a batch and a personal
Zoom trial link → Razorpay payment keeps the link; unpaid trials expire and the Zoom registrant is cancelled.

Next.js 16 (App Router) · Prisma 7 + PostgreSQL · Auth.js · Tailwind v4 + shadcn/ui. Read `AGENTS.md`
before changing code.

WhatsApp, Zoom and Razorpay sit behind adapters in `src/lib/{whatsapp,zoom,razorpay}`. With
`INTEGRATIONS_MODE=fake` (the default) nothing leaves your machine and the whole flow runs locally.

## Run it locally (WSL / Ubuntu)

1. **Postgres** (any version ≥ 16). With the apt package:

   ```bash
   sudo apt install postgresql
   sudo -u postgres psql -c "CREATE ROLE adleads LOGIN PASSWORD 'adleads' CREATEDB;" \
                         -c "CREATE DATABASE adleads OWNER adleads;"
   ```

   `CREATEDB` lets `prisma migrate dev` create its temporary shadow database.

2. **Environment**: `cp .env.example .env`, then fill in:

   | Key | Value for local dev |
   | --- | --- |
   | `DATABASE_URL` | `postgresql://adleads:adleads@localhost:5432/adleads` |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `http://localhost:3000` |
   | `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET` | any random strings (`openssl rand -hex 32`) |
   | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | the admin you'll sign in as |

   The WhatsApp/Zoom/Razorpay API keys are only required with `INTEGRATIONS_MODE=live`.

3. **Install, migrate, seed, run**

   ```bash
   npm install
   npm run db:migrate   # applies prisma/migrations and generates the client
   npm run db:seed      # safe to re-run; never overwrites your edits
   npm run dev
   ```

4. Open http://localhost:3000 and sign in with `SEED_ADMIN_EMAIL`. The seed also creates
   `sales@<same domain>` and `viewer@<same domain>` with the same password, so you can check each role.
   `npm run db:studio` opens Prisma Studio.

## Try the whole flow with the dev simulators

These pages exist only when `NODE_ENV !== 'production'` and need you to be signed in.

- **`/dev/whatsapp`** — you are the lead's phone. Pick a number (or a seeded lead), keep "Came from an
  ad" on, say "Hi", then answer and tap the bot's buttons/list rows. Each message is a real
  Meta-shaped webhook going through the same pipeline as production (store event → job → bot).
  Open the lead in **Leads** or **Inbox** in another tab to watch it live.
- **`/dev/pay/<link id>`** — fake Razorpay checkout. The link arrives in the chat as a
  `trial_payment_reminder`. **Pay now** sends a correctly signed `payment_link.paid` webhook to
  `/api/webhooks/razorpay` → the lead becomes ENROLLED. **Fail payment** leaves the link open.
- **`/dev/clock`** — run any cron job now, and **shift time by N days** to test trials:
  shift 2 days → **Run trials** (payment link sent) → **Run expire** → the trial is EXPIRED, its Zoom
  registrant cancelled and the seat offered to the waitlist. **Reset** puts the clock back.

Typical run: `/dev/whatsapp` "Hi" → name → course → batch → Confirm → you get a Zoom link →
`/dev/clock` shift 2 days → Run trials → open the payment link → Pay now → ENROLLED.

## Tests

```bash
npm test
```

Unit tests always run. Database tests (status transitions, the seat race, bot replays, `markPaid`,
`expire`, webhook routes) run only when `TEST_DATABASE_URL` is set, to a separate database whose name
contains `test` — it is wiped between tests:

```bash
sudo -u postgres psql -c "CREATE DATABASE adleads_test OWNER adleads;"
# add to .env:  TEST_DATABASE_URL=postgresql://adleads:adleads@localhost:5432/adleads_test
npm test
```

Before committing: `npm run lint`, `npx tsc --noEmit`, `npm test`.

## Production notes

- Build and run: `npm run build && npm start` (PM2: `ecosystem.config.js`).
- Scheduled jobs: install `crontab.txt` (replace `DOMAIN` and `SECRET`; server timezone Asia/Kolkata).
- Webhook URLs: `/api/webhooks/whatsapp` (Meta: GET handshake + POST), `/api/webhooks/razorpay`.
  Both verify signatures, store the event and return 200; the work happens in `/api/cron/jobs`.
- Going live: implement the `live.ts` adapters in `src/lib/{whatsapp,zoom,razorpay}` (each lists the API
  calls to make), fill in the API keys, and set `INTEGRATIONS_MODE=live`. Nothing else changes.
