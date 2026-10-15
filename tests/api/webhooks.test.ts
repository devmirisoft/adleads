import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { POST as razorpayPOST } from '@/app/api/webhooks/razorpay/route';
import { POST as cronJobs } from '@/app/api/cron/jobs/route';
import { db, hasTestDb, resetDb } from '../helpers/db';

const body = readFileSync(
  new URL('../fixtures/meta/text_with_referral.json', import.meta.url),
  'utf8',
);
const sign = (raw: string, secret: string) =>
  createHmac('sha256', secret).update(raw).digest('hex');
const post = (url: string, raw: string, headers: Record<string, string>) =>
  new Request(url, { method: 'POST', body: raw, headers });

describe('GET /api/webhooks/whatsapp (Meta handshake)', () => {
  const url = (token: string) =>
    new NextRequest(
      `http://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`,
    );

  it('echoes the challenge for the right verify token', async () => {
    const res = GET(url(encodeURIComponent(process.env.WA_VERIFY_TOKEN!)));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('12345');
  });

  it('rejects a wrong token', () => {
    expect(GET(url('nope')).status).toBe(403);
  });
});

describe.skipIf(!hasTestDb)('webhook POSTs: verify → store → 200', () => {
  beforeEach(resetDb);

  it('WhatsApp: bad signature → 401, nothing stored', async () => {
    const res = await POST(
      post('http://x', body, { 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` }),
    );
    expect(res.status).toBe(401);
    expect(await db.webhookEvent.count()).toBe(0);
  });

  it('WhatsApp: signed fixture → 200, event + processWebhook job stored once across retries', async () => {
    const headers = { 'x-hub-signature-256': `sha256=${sign(body, process.env.WA_APP_SECRET!)}` };
    for (let i = 0; i < 2; i++)
      expect((await POST(post('http://x', body, headers))).status).toBe(200);
    const events = await db.webhookEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      provider: 'META',
      eventKey: 'meta:wamid.HBgMOTE5ODEyMzQ1Njc4FQIAEhggQUJDMTIz',
    });
    expect(await db.job.count({ where: { type: 'processWebhook' } })).toBe(1);
    expect(await db.lead.count()).toBe(0); // no work inside the request
  });

  it('Razorpay: checks x-razorpay-signature and dedupes on the event id', async () => {
    const raw = JSON.stringify({ event: 'payment.failed', payload: {} });
    const bad = await razorpayPOST(
      post('http://x', raw, { 'x-razorpay-signature': 'f'.repeat(64) }),
    );
    expect(bad.status).toBe(401);
    const headers = {
      'x-razorpay-signature': sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET!),
      'x-razorpay-event-id': 'evt_1',
    };
    for (let i = 0; i < 2; i++)
      expect((await razorpayPOST(post('http://x', raw, headers))).status).toBe(200);
    expect(await db.webhookEvent.count({ where: { eventKey: 'razorpay:evt_1' } })).toBe(1);
  });

  it('cron routes need x-cron-secret', async () => {
    expect((await cronJobs(post('http://x', '', {}))).status).toBe(401);
    const ok = await cronJobs(post('http://x', '', { 'x-cron-secret': process.env.CRON_SECRET! }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ done: 0, failed: [] });
  });
});
