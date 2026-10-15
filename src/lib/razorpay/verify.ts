import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay webhook signature: header `X-Razorpay-Signature` = hex HMAC-SHA256 of the raw body,
 * keyed with the webhook secret. Pass the body exactly as received (before JSON.parse).
 */
export function verifyRazorpaySignature(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  webhookSecret: string,
): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** Signs a body the way Razorpay does — used by the /dev/pay simulator and tests. */
export function signRazorpayBody(rawBody: string, webhookSecret: string): string {
  return createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
}
