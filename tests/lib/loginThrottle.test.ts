import { beforeEach, describe, expect, it } from 'vitest';
import { isLoginThrottled, recordFailedLogin } from '@/lib/auth';
import { db, hasTestDb, resetDb } from '../helpers/db';

describe.skipIf(!hasTestDb)('login throttle', () => {
  beforeEach(resetDb);

  it('blocks an IP after 5 failures and leaves other IPs alone', async () => {
    for (let i = 0; i < 4; i++) await recordFailedLogin('203.0.113.1');
    expect(await isLoginThrottled('203.0.113.1')).toBe(false);
    await recordFailedLogin('203.0.113.1');
    expect(await isLoginThrottled('203.0.113.1')).toBe(true);
    expect(await isLoginThrottled('203.0.113.2')).toBe(false);
  });

  it('forgets failures older than 15 minutes', async () => {
    const old = new Date(Date.now() - 16 * 60_000);
    await db.loginAttempt.createMany({
      data: Array.from({ length: 5 }, () => ({ ip: '203.0.113.1', createdAt: old })),
    });
    expect(await isLoginThrottled('203.0.113.1')).toBe(false);
  });
});
