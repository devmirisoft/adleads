import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta webhook signature: header `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw body>`
 * keyed with the app secret. Pass the body exactly as received (before JSON.parse).
 */
export function verifyWhatsAppSignature(
  rawBody: string | Buffer,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  const received = header?.startsWith('sha256=') ? header.slice('sha256='.length) : null;
  if (!received || !/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(received, 'hex'));
}
