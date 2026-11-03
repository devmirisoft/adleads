import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/realtime/auth/route';
import { realtime } from '@/lib/realtime/client';

const requireUser = vi.hoisted(() => vi.fn());
vi.mock('@/modules/auth', () => ({ requireUser }));

const LEAD = 'private-lead-11111111-1111-4111-8111-111111111111';

const request = (channel: string, socket = '123.456') =>
  new Request('http://x/api/realtime/auth', {
    method: 'POST',
    body: new URLSearchParams({ socket_id: socket, channel_name: channel }),
  });

describe('POST /api/realtime/auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireUser.mockResolvedValue({ id: 'u1', role: 'VIEWER' });
  });

  it('turns the redirect from an unauthenticated requireUser() into a 401, signing nothing', async () => {
    requireUser.mockRejectedValue(new Error('NEXT_REDIRECT'));
    const authorize = vi.spyOn(realtime, 'authorize');
    expect((await POST(request(LEAD))).status).toBe(401);
    expect(authorize).not.toHaveBeenCalled();
  });

  it.each([
    'public-chat',
    'presence-lead-11111111-1111-4111-8111-111111111111',
    'lead-11111111-1111-4111-8111-111111111111',
    'private-lead-not-a-uuid',
    'private-other',
    'private-inbox-x',
    '',
  ])('refuses channel "%s"', async (channel) => {
    const authorize = vi.spyOn(realtime, 'authorize');
    expect((await POST(request(channel))).status).toBe(403);
    expect(authorize).not.toHaveBeenCalled();
  });

  it('refuses a malformed socket id or body', async () => {
    expect((await POST(request(LEAD, 'nope'))).status).toBe(403);
    const notForm = new Request('http://x', { method: 'POST', body: '{}' });
    expect((await POST(notForm)).status).toBe(403);
  });

  it.each([LEAD, 'private-inbox'])(
    'signs %s for any staff role, VIEWER included',
    async (channel) => {
      const authorize = vi.spyOn(realtime, 'authorize').mockReturnValue({ auth: 'key:sig' });
      const res = await POST(request(channel));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ auth: 'key:sig' });
      expect(authorize).toHaveBeenCalledWith('123.456', channel);
    },
  );

  it('answers 404 with realtime off, so the browser stays on polling', async () => {
    expect((await POST(request(LEAD))).status).toBe(404);
  });
});
