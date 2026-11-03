import { describe, expect, it } from 'vitest';
import { isCronRequest } from '@/app/_jobs/cronAuth';

const secret = process.env.CRON_SECRET!;
const req = (headers: Record<string, string>) => new Request('http://x', { headers });

describe('isCronRequest', () => {
  it('accepts the secret as x-cron-secret or Authorization: Bearer', () => {
    expect(isCronRequest(req({ 'x-cron-secret': secret }))).toBe(true);
    expect(isCronRequest(req({ authorization: `Bearer ${secret}` }))).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isCronRequest(req({}))).toBe(false);
    expect(isCronRequest(req({ 'x-cron-secret': 'nope' }))).toBe(false);
    expect(isCronRequest(req({ authorization: secret }))).toBe(false);
    expect(isCronRequest(req({ authorization: `Basic ${secret}` }))).toBe(false);
    expect(isCronRequest(req({ authorization: `Bearer ${secret}x` }))).toBe(false);
  });
});
