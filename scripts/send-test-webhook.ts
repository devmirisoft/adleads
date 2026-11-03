// TEMPORARY: POST a correctly signed Meta `messages` webhook and report what came back.
// Usage: npx tsx scripts/send-test-webhook.ts <url>
// The URL can also come from WEBHOOK_URL; WA_APP_SECRET comes from the environment, then .env.
import 'dotenv/config';
import { createHmac } from 'node:crypto';
import { buildMetaPayload } from '@/modules/messaging/utils/metaPayload';

// normalizePhone rejects this, so the processWebhook job creates no lead and messages nobody.
const FAKE_SENDER = '000000000000';
const TIMEOUT_MS = 60000;

async function main() {
  const url = process.argv[2] ?? process.env.WEBHOOK_URL;
  const secret = process.env.WA_APP_SECRET;
  if (!url || !secret) {
    throw new Error(
      'Usage: npx tsx scripts/send-test-webhook.ts <url> (WA_APP_SECRET must be set)',
    );
  }

  // buildMetaPayload generates a new message id each run, so every run stores a new row.
  const body = JSON.stringify(
    buildMetaPayload({
      waId: FAKE_SENDER,
      profileName: 'Webhook test',
      message: { kind: 'text', text: 'Webhook test' },
    }),
  );
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  const startedAt = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  console.log(`status=${res.status} time=${Date.now() - startedAt}ms body=${text}`);
}

main().catch((e) => {
  console.error(`failed: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
  process.exitCode = 1;
});
