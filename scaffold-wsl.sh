#!/usr/bin/env bash
case "$0" in *.sh) if grep -q "$(printf '\r')" "$0" 2>/dev/null; then echo "Fixing Windows (CRLF) line endings in $0 and restarting..."; sed -i 's/\r$//' "$0"; exec bash "$0" "$@"; fi ;; esac #
# Scaffold the WhatsApp Enquiry & Trial System (modules-based Next.js layout) — WSL edition.
#
# Usage (inside WSL / Ubuntu terminal):
#   bash scaffold-wsl.sh [--init] [--yes] [project-dir]
#
#   project-dir   default: the current folder if it's a Next.js project,
#                 otherwise ~/projects/whatsapp-trial-system
#                 Windows paths are accepted too, e.g. 'C:\Users\me\code\app' (quote it)
#   --init        create the Next.js app if missing + install dependencies (needs Node 20+)
#   --yes         don't ask before moving app/ to src/app or using a slow /mnt/<drive> path
#
# Existing project with app/ at the root (no src/)? It is moved to src/app and
# the "@/*" alias in tsconfig.json is pointed at ./src/*.
# Safe to re-run: existing files are never overwritten.

# ---- must be bash (Ubuntu's `sh` is dash) ----
if [ -z "${BASH_VERSION:-}" ]; then
  echo "Run this with bash:  bash scaffold-wsl.sh" >&2
  exit 1
fi

set -euo pipefail

# ---- args ----
INIT=0
ASSUME_YES=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --init) INIT=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) sed -n '3,17p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $arg" >&2; exit 1 ;;
    *) TARGET="$arg" ;;
  esac
done
if [[ -z "$TARGET" ]]; then
  if [[ -f package.json ]] && grep -q '"next"' package.json; then
    TARGET="$PWD"                                   # run from inside an existing project
  else
    TARGET="$HOME/projects/whatsapp-trial-system"
  fi
fi

# ---- WSL checks ----
IS_WSL=0
if grep -qi microsoft /proc/version 2>/dev/null; then IS_WSL=1; fi
[[ $IS_WSL -eq 1 ]] || echo "Note: this doesn't look like WSL; continuing as plain Linux."

# Windows path (C:\... or C:/...) -> /mnt/c/...
if [[ "$TARGET" =~ ^[A-Za-z]:[\\/] ]]; then
  if command -v wslpath >/dev/null 2>&1; then
    TARGET="$(wslpath -u "$TARGET")"
  else
    echo "Got a Windows path but 'wslpath' isn't available: $TARGET" >&2
    exit 1
  fi
fi

ROOT="$(realpath -m "$TARGET")"   # absolute path; nothing is created yet

# Projects on the Windows drive (/mnt/c) are very slow in WSL and break hot reload.
if [[ "$ROOT" == /mnt/* ]]; then
  echo "WARNING: $ROOT is on the Windows filesystem."
  echo "  npm install / next dev will be much slower and file watching is unreliable there."
  echo "  Recommended: keep it inside WSL, e.g. ~/projects/whatsapp-trial-system"
  echo "  (Windows can still open it at \\\\wsl\$\\<distro>\\home\\${USER:-$(whoami)}\\projects)"
  if [[ $ASSUME_YES -eq 0 ]]; then
    read -r -p "Continue anyway? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
  fi
fi

# ---- existing project with app/ at the root -> move to src/app ----
if [[ -f "$ROOT/package.json" && -d "$ROOT/app" ]]; then
  if [[ -e "$ROOT/src/app" ]]; then
    echo "Both app/ and src/app/ exist. Next.js uses app/ and ignores src/app/ — merge them by hand first." >&2
    exit 1
  fi
  echo "Found app/ at the project root (created without --src-dir)."
  echo "  Will move:   app/  ->  src/app/"
  echo "  Will update: tsconfig.json  \"@/*\": [\"./*\"]  ->  [\"./src/*\"]"
  echo "  Will delete: .next/ (build cache, rebuilt automatically)"
  if [[ $ASSUME_YES -eq 0 ]]; then
    read -r -p "Go ahead? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted. Nothing changed."; exit 1; }
  fi

  mkdir -p "$ROOT/src"
  if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
     && [[ -n "$(git -C "$ROOT" ls-files app)" ]]; then
    git -C "$ROOT" mv app src/app                 # keeps file history
    # untracked leftovers (if any) that git mv didn't take
    if [[ -d "$ROOT/app" ]]; then cp -rn "$ROOT/app/." "$ROOT/src/app/" && rm -rf "$ROOT/app"; fi
  else
    mv "$ROOT/app" "$ROOT/src/app"
  fi
  rm -rf "$ROOT/.next"

  TSCONFIG="$ROOT/tsconfig.json"
  if [[ -f "$TSCONFIG" ]]; then
    sed -i -E 's#"@/\*"[[:space:]]*:[[:space:]]*\[[[:space:]]*"\./\*"[[:space:]]*\]#"@/*": ["./src/*"]#' "$TSCONFIG"
    if grep -q '"\./src/\*"' "$TSCONFIG"; then
      echo "  tsconfig.json updated."
    else
      echo "  Couldn't find the \"@/*\" alias in tsconfig.json — set compilerOptions.paths to { \"@/*\": [\"./src/*\"] } by hand." >&2
    fi
  fi

  # imports like '@/app/...' would now point at src/app — they still resolve the same way,
  # but flag any '@/' import that pointed outside app/ (it now needs to live in src/)
  if grep -rqE "from ['\"]@/(components|lib|utils|hooks)/" "$ROOT/src/app" 2>/dev/null; then
    echo "  Note: some files import '@/components|lib|utils|hooks/...'. Move those folders into src/ too." >&2
  fi
  echo "Moved app/ to src/app/."
fi

# ---- optional: create the Next.js app + install deps ----
if [[ $INIT -eq 1 ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found in WSL. Install it inside WSL (not Windows), e.g. with nvm:" >&2
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash" >&2
    echo "  source ~/.bashrc && nvm install --lts" >&2
    exit 1
  fi
  if [[ "$(command -v node)" == /mnt/* ]]; then
    echo "WARNING: 'node' is the Windows install ($(command -v node)). Install Node inside WSL with nvm." >&2
    exit 1
  fi
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if (( NODE_MAJOR < 20 )); then
    echo "Node $NODE_MAJOR found; Next.js needs Node 20+. Run: nvm install --lts" >&2
    exit 1
  fi

  if [[ -d "$ROOT" && -n "$(ls -A "$ROOT" 2>/dev/null)" ]]; then
    echo "$ROOT already exists and isn't empty — skipping create-next-app."
  else
    echo "Creating Next.js app in $ROOT ..."
    mkdir -p "$(dirname "$ROOT")"
    npx --yes create-next-app@latest "$ROOT" \
      --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-npm --yes
  fi
fi

CREATED=0
SKIPPED=0

# mk <path> [content]  -> creates parent dirs + file only if it doesn't exist
mk() {
  local path="$ROOT/$1"
  local content="${2:-}"
  mkdir -p "$(dirname "$path")"
  if [[ -e "$path" ]]; then
    SKIPPED=$((SKIPPED + 1))
    return
  fi
  printf '%s' "$content" > "$path"
  CREATED=$((CREATED + 1))
}

# mkdirk <dir> -> empty dir kept in git
mkdirk() {
  mkdir -p "$ROOT/$1"
  [[ -e "$ROOT/$1/.gitkeep" ]] || touch "$ROOT/$1/.gitkeep"
}

# ---------- stub templates ----------
page() { # page <ComponentName> <Title>
  cat <<EOF
export default function ${1}() {
  return <h1>${2}</h1>;
}
EOF
}

route() { # route <METHOD...>
  local out=""
  for m in "$@"; do
    out+="export async function ${m}() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}

"
  done
  printf '%s' "$out"
}

SERVICE="import 'server-only';

"
COMPONENT() { # COMPONENT <Name>
  cat <<EOF
export function ${1}() {
  return null;
}
EOF
}
INDEX="// Public API of this module — import from '@/modules/<name>' only.
"

# =====================================================================
# Root files
# =====================================================================
mkdirk public
# Prisma 7 layout: the DB URL lives in prisma.config.ts, not in schema.prisma
mk prisma/schema.prisma 'generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Models: courses, batches, leads, lead_events, questions, question_options,
// answers, enrollments, payments, messages, webhook_events, jobs, users, settings
'
mk prisma.config.ts "import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
"
mkdirk prisma/migrations
mk prisma/seed.ts '// Seed: sample courses, batches, bot questions, first admin user
'
mk .env.example 'DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
WA_PHONE_NUMBER_ID=
WA_BUSINESS_ACCOUNT_ID=
WA_ACCESS_TOKEN=
WA_APP_SECRET=
WA_VERIFY_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
CRON_SECRET=
APP_TIMEZONE=Asia/Kolkata
'
mk ecosystem.config.js "module.exports = {
  apps: [{ name: 'whatsapp-trial-system', script: 'npm', args: 'start' }],
};
"
mk crontab.txt '# Replace DOMAIN and SECRET, then: crontab crontab.txt
* * * * *    curl -s -X POST -H "x-cron-secret: SECRET" https://DOMAIN/api/cron/jobs
*/30 * * * * curl -s -X POST -H "x-cron-secret: SECRET" https://DOMAIN/api/cron/nudges
0 9 * * *    curl -s -X POST -H "x-cron-secret: SECRET" https://DOMAIN/api/cron/trials
30 23 * * *  curl -s -X POST -H "x-cron-secret: SECRET" https://DOMAIN/api/cron/expire
'

# =====================================================================
# src/app — ROUTES ONLY
# =====================================================================
# create-next-app already makes src/app/layout.tsx + src/app/globals.css — only add ours if missing
if [[ ! -e "$ROOT/src/app/globals.css" ]]; then
  mk src/app/layout.tsx "import './styles/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang=\"en\">
      <body>{children}</body>
    </html>
  );
}
"
  mk src/app/styles/globals.css ''
fi
# Next.js 16: middleware.ts is now proxy.ts (exported as \`proxy\`)
mk src/proxy.ts "// Protects (admin) pages and /api/admin/* — must live at src/proxy.ts
export { auth as proxy } from '@/lib/auth';

export const config = { matcher: ['/((?!api/webhooks|api/cron|login|_next|favicon.ico).*)'] };
"

mk "src/app/(auth)/login/page.tsx"                 "$(page LoginPage 'Login')"
mk "src/app/(admin)/layout.tsx" "export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
"
mk "src/app/(admin)/dashboard/page.tsx"            "$(page DashboardPage 'Dashboard')"
mk "src/app/(admin)/leads/page.tsx"                "$(page LeadsPage 'Leads')"
mk "src/app/(admin)/leads/[id]/page.tsx"           "$(page LeadDetailPage 'Lead')"
mk "src/app/(admin)/inbox/page.tsx"                "$(page InboxPage 'Inbox')"
mk "src/app/(admin)/batches/page.tsx"              "$(page BatchesPage 'Batches')"
mk "src/app/(admin)/batches/[id]/page.tsx"         "$(page BatchDetailPage 'Batch')"
mk "src/app/(admin)/enrollments/page.tsx"          "$(page EnrollmentsPage 'Enrollments')"
mk "src/app/(admin)/payments/page.tsx"             "$(page PaymentsPage 'Payments')"
mk "src/app/(admin)/script/page.tsx"               "$(page ScriptPage 'Bot script')"
mk "src/app/(admin)/settings/page.tsx"             "$(page SettingsPage 'Settings')"

# API: auth
mk "src/app/api/auth/[...nextauth]/route.ts"       "export { GET, POST } from '@/lib/auth';
"
# API: webhooks
mk src/app/api/webhooks/whatsapp/route.ts          "$(route GET POST)"
mk src/app/api/webhooks/leadgen/route.ts           "$(route GET POST)"
mk src/app/api/webhooks/razorpay/route.ts          "$(route POST)"
# API: cron
for j in jobs nudges trials expire; do
  mk "src/app/api/cron/$j/route.ts"                "$(route POST)"
done
# API: admin
mk src/app/api/admin/leads/route.ts                "$(route GET)"
mk "src/app/api/admin/leads/[id]/route.ts"         "$(route GET PATCH)"
mk "src/app/api/admin/leads/[id]/messages/route.ts" "$(route POST)"
mk src/app/api/admin/courses/route.ts              "$(route GET POST)"
mk "src/app/api/admin/courses/[id]/route.ts"       "$(route PATCH DELETE)"
mk src/app/api/admin/batches/route.ts              "$(route GET POST)"
mk "src/app/api/admin/batches/[id]/route.ts"       "$(route GET PATCH DELETE)"
mk "src/app/api/admin/enrollments/[id]/route.ts"   "$(route PATCH)"
mk src/app/api/admin/payments/route.ts             "$(route GET POST)"
mk "src/app/api/admin/payments/[id]/resend/route.ts" "$(route POST)"
mk src/app/api/admin/questions/route.ts            "$(route GET POST PATCH)"
mk src/app/api/admin/settings/route.ts             "$(route GET PATCH)"
mk src/app/api/admin/users/route.ts                "$(route GET POST PATCH)"
mk src/app/api/admin/reports/funnel/route.ts       "$(route GET)"

# =====================================================================
# src/lib — CLIENTS + CONFIG
# =====================================================================
mk src/lib/config.ts      "${SERVICE}// Validate all env vars with zod at boot
"
mk src/lib/db.ts          "${SERVICE}// Prisma client singleton (run \`npx prisma generate\` first)
// import { PrismaClient } from '@/generated/prisma/client';
// import { PrismaPg } from '@prisma/adapter-pg';
//
// const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
// export const db =
//   globalForPrisma.prisma ??
//   new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
"
mk src/lib/auth.ts        "// Auth.js config — exports auth, GET, POST
"
mk src/lib/whatsapp/client.ts  "${SERVICE}// Raw WhatsApp Cloud API calls (POST /{phone-number-id}/messages)
"
mk src/lib/whatsapp/verify.ts  "${SERVICE}// Verify X-Hub-Signature-256 with WA_APP_SECRET
"
mk src/lib/zoom/client.ts      "${SERVICE}// Zoom S2S OAuth token cache + raw calls (registrants add/cancel)
"
mk src/lib/razorpay/client.ts  "${SERVICE}// Razorpay raw calls + webhook signature verify
"

# =====================================================================
# src/modules
# =====================================================================
M=src/modules

# ---- core ----
for c in Button Table Badge Sidebar StatTile; do
  mk "$M/core/components/$c.tsx" "$(COMPONENT "$c")"
done
mk $M/core/hooks/usePagination.ts  "export function usePagination() {}
"
mk $M/core/hooks/useDebounce.ts    "export function useDebounce() {}
"
mk $M/core/constants/index.ts      "export const APP_TIMEZONE = 'Asia/Kolkata';
export const ROLES = ['ADMIN', 'SALES', 'VIEWER'] as const;
"
mk $M/core/types/index.ts          "export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
"
mk $M/core/utils/phone.ts          "// Normalize to E.164 (+91XXXXXXXXXX)
"
mk $M/core/utils/dates.ts          "// IST helpers, trial end maths
"
mk $M/core/utils/money.ts          "// paise <-> ₹ formatting
"

# ---- auth ----
mk $M/auth/components/LoginForm.tsx "$(COMPONENT LoginForm)"
mk $M/auth/services/requireRole.ts  "$SERVICE"
mk $M/auth/index.ts                 "$INDEX"

# ---- messaging ----
mk $M/messaging/components/ChatThread.tsx "$(COMPONENT ChatThread)"
mk $M/messaging/components/ReplyBox.tsx   "$(COMPONENT ReplyBox)"
mk $M/messaging/hooks/useChatPolling.ts   "export function useChatPolling() {}
"
mk $M/messaging/services/send.ts          "${SERVICE}// sendText, sendButtons, sendList, sendTemplate — checks 24h window, logs to messages
"
mk $M/messaging/services/parseWebhook.ts  "${SERVICE}// Raw Meta webhook JSON -> InboundMessage[]
"
mk $M/messaging/services/window.ts        "${SERVICE}// Is the 24h customer service window open?
"
mk $M/messaging/constants/templates.ts    "export const TEMPLATES = {
  classReminder: 'class_reminder',
  trialPaymentReminder: 'trial_payment_reminder',
  trialLastDay: 'trial_last_day',
  enrollmentConfirmed: 'enrollment_confirmed',
  trialEnded: 'trial_ended',
  waitlistSeatOpen: 'waitlist_seat_open',
} as const;
"
mk $M/messaging/types/index.ts "export type InboundMessage = {
  waId: string;
  phone: string;
  profileName?: string;
  messageId: string;
  timestamp: Date;
  kind: 'text' | 'button' | 'list' | 'other';
  text?: string;
  replyId?: string;
  referral?: { adId: string; ctwaClid?: string; headline?: string };
};
"
mk $M/messaging/index.ts "$INDEX"

# ---- bot ----
mk $M/bot/services/engine.ts   "${SERVICE}// handleInbound(msg): route by lead status + current step
"
mk $M/bot/services/keywords.ts "${SERVICE}// STOP / HELP / AGENT / RESTART
"
for s in name course batch confirm; do
  mk "$M/bot/services/steps/$s.ts" "${SERVICE}// BotStep: ${s}
"
done
mk $M/bot/components/QuestionEditor.tsx "$(COMPONENT QuestionEditor)"
mk $M/bot/types/index.ts "import type { InboundMessage } from '@/modules/messaging';

export type StepKey = 'name' | 'course' | 'batch' | 'confirm';

export type StepResult =
  | { result: 'next' }
  | { result: 'retry'; reason: string }
  | { result: 'goto'; step: StepKey }
  | { result: 'done' };

export interface BotStep<Lead = unknown> {
  key: StepKey;
  ask(lead: Lead): Promise<void>;
  handle(lead: Lead, msg: InboundMessage): Promise<StepResult>;
}
"
mk $M/bot/index.ts "$INDEX"

# ---- leads ----
for c in LeadsTable LeadFilters StatusBadge LeadTimeline; do
  mk "$M/leads/components/$c.tsx" "$(COMPONENT "$c")"
done
mk $M/leads/hooks/useLeadFilters.ts  "export function useLeadFilters() {}
"
mk $M/leads/services/upsertLead.ts   "${SERVICE}// Find or create lead by phone; save ad referral
"
mk $M/leads/services/transition.ts   "${SERVICE}// ONLY way to change lead status — writes lead_events
"
mk $M/leads/services/queries.ts      "${SERVICE}// list, detail, inbox queries
"
mk $M/leads/constants/statuses.ts "export const LEAD_STATUS = [
  'NEW', 'ASKING', 'QUALIFIED', 'WAITLISTED', 'TRIAL_ACTIVE', 'PAYMENT_PENDING',
  'ENROLLED', 'EXPIRED', 'DROPPED', 'OPTED_OUT', 'CANCELLED',
] as const;
"
mk $M/leads/types/index.ts ''
mk $M/leads/index.ts "$INDEX"

# ---- batches ----
for c in BatchForm BatchTable SeatMeter; do
  mk "$M/batches/components/$c.tsx" "$(COMPONENT "$c")"
done
mk $M/batches/services/batches.ts     "${SERVICE}// CRUD, OPEN/FULL/CLOSED
"
mk $M/batches/services/zoomMeeting.ts "${SERVICE}// Create recurring Zoom meeting (registration on) for a batch
"
mk $M/batches/types/index.ts ''
mk $M/batches/index.ts "$INDEX"

# ---- enrollments ----
mk $M/enrollments/components/EnrollmentTable.tsx   "$(COMPONENT EnrollmentTable)"
mk $M/enrollments/components/ExtendTrialDialog.tsx "$(COMPONENT ExtendTrialDialog)"
mk $M/enrollments/services/assignSeat.ts    "${SERVICE}// Locked transaction: SELECT ... FOR UPDATE on batch, insert enrollment
"
mk $M/enrollments/services/sendTrialLink.ts "${SERVICE}// Zoom register -> WhatsApp trial confirmation
"
mk $M/enrollments/services/expire.ts        "${SERVICE}// Cancel registrant, free seat, send trial_ended
"
mk $M/enrollments/services/cancel.ts        "${SERVICE}// Refund / staff cancel
"
mk $M/enrollments/constants/trial.ts "export const DEFAULT_TRIAL_DAYS = 3;
export const PAYMENT_REMINDER_DAYS_BEFORE = 2;
"
mk $M/enrollments/types/index.ts ''
mk $M/enrollments/index.ts "$INDEX"

# ---- payments ----
mk $M/payments/components/PaymentsTable.tsx     "$(COMPONENT PaymentsTable)"
mk $M/payments/components/ManualPaymentForm.tsx "$(COMPONENT ManualPaymentForm)"
mk $M/payments/services/requestPayment.ts       "${SERVICE}// Create Razorpay link -> send reminder template
"
mk $M/payments/services/markPaid.ts             "${SERVICE}// Single path to ENROLLED (webhook + manual)
"
mk $M/payments/services/handleRazorpayEvent.ts  "${SERVICE}// payment_link.paid / expired / refund.processed
"
mk $M/payments/types/index.ts ''
mk $M/payments/index.ts "$INDEX"

# ---- jobs ----
mk $M/jobs/services/queue.ts  "${SERVICE}// enqueue(type, payload, runAt)
"
mk $M/jobs/services/runner.ts "${SERVICE}// Pick PENDING jobs, run, retry with backoff (max 5)
"
for h in processWebhook sendMessage zoomRegister zoomCancel createPaymentLink; do
  mk "$M/jobs/services/handlers/$h.ts" "${SERVICE}// Job handler: ${h}
"
done
mk $M/jobs/index.ts "$INDEX"

# ---- dashboard ----
for c in FunnelCard RevenueCard LeadsByAdTable; do
  mk "$M/dashboard/components/$c.tsx" "$(COMPONENT "$c")"
done
mk $M/dashboard/services/reports.ts "${SERVICE}// Funnel, revenue, leads by ad
"
mk $M/dashboard/index.ts "$INDEX"

# ---- settings ----
mk $M/settings/components/SettingsForm.tsx "$(COMPONENT SettingsForm)"
mk $M/settings/components/UsersTable.tsx   "$(COMPONENT UsersTable)"
mk $M/settings/services/settings.ts "$SERVICE"
mk $M/settings/services/users.ts    "$SERVICE"
mk $M/settings/index.ts "$INDEX"

# =====================================================================
# tests
# =====================================================================
mkdirk tests/fixtures
mk tests/modules/bot.test.ts                     "// Replay fixtures through bot engine
"
mk tests/modules/enrollments.assignSeat.test.ts  "// Two leads racing for the last seat
"

echo "Scaffold done: $ROOT  (created $CREATED files, skipped $SKIPPED existing)"

# ---- optional: dependencies ----
if [[ $INIT -eq 1 ]]; then
  echo "Installing dependencies..."
  (
    cd "$ROOT"
    # Prisma pinned to 7: npm's "latest" tag currently points at an 8.0 release candidate
    npm install @prisma/client@7 @prisma/adapter-pg@7 pg dotenv next-auth@beta zod server-only razorpay
    npm install -D prisma@7 tsx @types/pg
  )
fi

# keep generated Prisma client out of git
if [[ -f "$ROOT/.gitignore" ]] && ! grep -q '^/src/generated' "$ROOT/.gitignore"; then
  printf '\n# prisma client\n/src/generated\n' >> "$ROOT/.gitignore"
fi

cat <<EOF

Next steps:
  cd "$ROOT"
  cp .env.example .env            # fill in the keys
  code .                          # opens VS Code connected to WSL (needs the WSL extension)
  npx prisma migrate dev          # once schema.prisma has the models (also generates the client)
  npm run dev                     # http://localhost:3000 works from Windows browsers too
EOF
