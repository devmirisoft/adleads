// TODO(live): Facebook Lead Ads ingestion (out of scope for now).
//  - GET: same hub.challenge handshake as /api/webhooks/whatsapp (page subscription, field "leadgen").
//  - POST: verify X-Hub-Signature-256 → recordWebhook('META', `leadgen:${leadgen_id}`, payload) → 200.
//  - Job: GET https://graph.facebook.com/v21.0/{leadgen_id} (page token) → upsert lead with source LEAD_FORM.
const notYet = () =>
  Response.json({ error: 'Lead form ingestion is not set up yet' }, { status: 501 });

export const GET = notYet;
export const POST = notYet;
