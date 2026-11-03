import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pusher = vi.hoisted(() => ({
  construct: vi.fn(),
  trigger: vi.fn(),
  authorizeChannel: vi.fn(),
}));
vi.mock('pusher', () => ({
  default: class {
    constructor(options: unknown) {
      pusher.construct(options);
    }
    trigger = pusher.trigger;
    authorizeChannel = pusher.authorizeChannel;
  },
}));

const KEYS = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];

// config.ts parses the env on import, and the adapter is chosen once, so each case imports afresh.
const load = () => import('@/lib/realtime/client');

function live() {
  vi.stubEnv('REALTIME_MODE', 'pusher');
  vi.stubEnv('PUSHER_APP_ID', 'app');
  vi.stubEnv('PUSHER_KEY', 'public-key');
  vi.stubEnv('PUSHER_SECRET', 'secret-value');
  vi.stubEnv('PUSHER_CLUSTER', 'ap2');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  KEYS.forEach((k) => vi.stubEnv(k, ''));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('REALTIME_MODE=off', () => {
  it('is the default, and never touches Pusher', async () => {
    const { publish, publishInboxChanged, realtime, realtimePublicConfig } = await load();
    await publish('private-inbox', 'x', {});
    await publishInboxChanged();
    expect(realtime.authorize('1.2', 'private-inbox')).toBeNull();
    expect(realtimePublicConfig()).toBeNull(); // no config: the browser polls
    expect(pusher.construct).not.toHaveBeenCalled();
    expect(pusher.trigger).not.toHaveBeenCalled();
  });
});

describe('REALTIME_MODE=pusher', () => {
  it.each(KEYS)('needs %s', async (missing) => {
    live();
    vi.stubEnv(missing, '');
    await expect(load()).rejects.toThrow(`${missing}: required when REALTIME_MODE=pusher`);
  });

  it('publishes through Pusher and signs subscriptions', async () => {
    live();
    pusher.authorizeChannel.mockReturnValue({ auth: 'public-key:sig' });
    const { publish, realtime } = await load();
    await publish('private-inbox', 'inbox.changed', {});
    expect(pusher.construct).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'app', cluster: 'ap2', useTLS: true }),
    );
    expect(pusher.trigger).toHaveBeenCalledWith('private-inbox', 'inbox.changed', {});
    expect(realtime.authorize('1.2', 'private-inbox')).toEqual({ auth: 'public-key:sig' });
  });

  it('hands the browser the public key and cluster only', async () => {
    live();
    const { realtimePublicConfig } = await load();
    expect(realtimePublicConfig()).toEqual({ key: 'public-key', cluster: 'ap2' });
    expect(JSON.stringify(realtimePublicConfig())).not.toContain('secret-value');
  });

  it("swallows a failed publish and logs nothing from Pusher's error, which holds the signed URL", async () => {
    live();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    pusher.trigger.mockRejectedValue(
      Object.assign(new Error('Unexpected status code 413'), {
        name: 'PusherRequestError',
        status: 413,
        url: 'https://api-ap2.pusher.com/apps/app/events?auth_signature=SECRET',
        body: 'message body from the lead',
      }),
    );
    const { publish } = await load();
    await expect(publish('private-inbox', 'x', { text: 'hello' })).resolves.toBeUndefined();
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).toContain('PusherRequestError');
    expect(logged).not.toMatch(/SECRET|message body|hello/);
  });
});
