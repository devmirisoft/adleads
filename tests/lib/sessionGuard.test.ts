import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devOnly } from '@/app/dev/devOnly';

// The proxy only checks that a cookie exists, and client navigations skip layouts, so anything that
// relies on its layout or the proxy is readable with a made-up cookie. Each entry point checks for itself.
const ROOTS = ['src/app/(admin)', 'src/app/dev', 'src/app/api'];

// Reachable without a session on purpose, each behind a check of its own.
const NO_SESSION = [
  /^src\/app\/api\/webhooks\//, // provider signature
  /^src\/app\/api\/cron\//, // CRON_SECRET
  /^src\/app\/api\/auth\//, // Auth.js itself
  /^src\/app\/api\/diag\/route\.ts$/, // temporary, DIAG_KEY header (asserted below)
];

/** What Next serves on its own: pages, route handlers and server actions. Layouts don't run on client navigation. */
const isEntryPoint = (file: string, source: string) =>
  /(^|\/)(page\.tsx|route\.ts)$/.test(file) || /^\s*['"]use server['"]/.test(source);

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const count = (source: string, pattern: RegExp) => (source.match(pattern) ?? []).length;

/** Calls, not mentions: an import or a comment doesn't protect anything. */
const sessionChecks = (source: string) =>
  count(stripComments(source), /\b(requireUser|requireRole|guarded)\s*[(<]/g);

/** Every exported handler or action needs its own check; a page needs one. */
function checksNeeded(file: string, source: string) {
  const code = stripComments(source);
  if (file.endsWith('page.tsx')) return 1;
  if (file.endsWith('route.ts'))
    return count(code, /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g) || 1;
  return count(code, /export\s+async\s+function\b/g) || 1;
}

const scanned = ROOTS.flatMap((root) =>
  readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((f) => join(root, f).replaceAll('\\', '/'))
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => isEntryPoint(f, readFileSync(f, 'utf8'))),
);
const guarded = scanned.filter((f) => !NO_SESSION.some((rule) => rule.test(f)));

describe('every entry point checks the session itself', () => {
  it.each(guarded)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(sessionChecks(source)).toBeGreaterThanOrEqual(checksNeeded(file, source));
  });
});

describe('dev pages hide themselves in production', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(guarded.filter((f) => f.startsWith('src/app/dev/') && f.endsWith('page.tsx')))(
    '%s',
    (file) => {
      expect(count(stripComments(readFileSync(file, 'utf8')), /\bdevOnly\(\)/g)).toBe(1);
    },
  );

  it('devOnly() is a 404 in production and nothing otherwise', () => {
    expect(() => devOnly()).not.toThrow();
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => devOnly()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

describe('the guard itself', () => {
  it('covers the pages that once relied on the layout, and doesn’t skip anything by accident', () => {
    expect(guarded).toEqual(
      expect.arrayContaining([
        'src/app/(admin)/dashboard/page.tsx',
        'src/app/(admin)/leads/[id]/page.tsx',
        'src/app/dev/ui/page.tsx',
        'src/app/dev/(tools)/clock/page.tsx',
        'src/app/dev/(tools)/clock/actions.ts',
        'src/app/dev/(tools)/pay/[linkId]/page.tsx',
        'src/app/dev/(tools)/pay/[linkId]/actions.ts',
        'src/app/dev/(tools)/whatsapp/page.tsx',
        'src/app/api/dev/whatsapp-inbound/route.ts',
        'src/app/api/dev/whatsapp-messages/route.ts',
        'src/app/api/admin/leads/route.ts',
        'src/app/api/realtime/auth/route.ts',
      ]),
    );
    // Only these are excused. A new folder under api/ is checked unless someone adds it above.
    expect(scanned.filter((f) => !guarded.includes(f)).sort()).toEqual([
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/cron/expire/route.ts',
      'src/app/api/cron/jobs/route.ts',
      'src/app/api/cron/nudges/route.ts',
      'src/app/api/cron/trials/route.ts',
      'src/app/api/diag/route.ts',
      'src/app/api/webhooks/leadgen/route.ts',
      'src/app/api/webhooks/razorpay/route.ts',
      'src/app/api/webhooks/whatsapp/route.ts',
    ]);
  });

  it('isn’t fooled by an import or a comment', () => {
    expect(sessionChecks(`import { requireUser } from '@/modules/auth';`)).toBe(0);
    expect(sessionChecks(`// await requireUser();\n/* requireRole() */`)).toBe(0);
    expect(sessionChecks(`  await requireUser();`)).toBe(1);
    expect(sessionChecks(`  return guarded(CAN_ACT, run);`)).toBe(1);
  });

  it('wants one check per handler or action', () => {
    const route = `export async function GET() {}\nexport function POST() {}\nexport const PUT = POST;`;
    expect(checksNeeded('a/route.ts', route)).toBe(2);
    expect(
      checksNeeded('a/actions.ts', `export async function a() {}\nexport async function b() {}`),
    ).toBe(2);
    expect(checksNeeded('a/page.tsx', `export default async function Page() {}`)).toBe(1);
  });

  it('the temporary diag route is excused only while it demands its key', () => {
    if (existsSync('src/app/api/diag/route.ts')) {
      expect(readFileSync('src/app/api/diag/route.ts', 'utf8')).toMatch(
        /!key \|\| req\.headers\.get\('x-diag-key'\) !== key\) return new Response\(null, \{ status: 404 \}\)/,
      );
    }
  });
});
