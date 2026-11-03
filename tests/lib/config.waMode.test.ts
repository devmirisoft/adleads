import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WA_KEYS = ['WA_PHONE_NUMBER_ID', 'WA_BUSINESS_ACCOUNT_ID', 'WA_ACCESS_TOKEN'];
const OTHER_KEYS = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
];
const set = (keys: string[], value: string) => keys.forEach((k) => vi.stubEnv(k, value));

// config.ts parses the env on import, so each case imports a fresh copy.
const load = () => import('@/lib/config');

beforeEach(() => {
  vi.resetModules();
  set([...WA_KEYS, ...OTHER_KEYS, 'WA_MODE'], ''); // blank counts as unset
  vi.stubEnv('INTEGRATIONS_MODE', 'fake');
});
afterEach(() => vi.unstubAllEnvs());

describe('WA_MODE', () => {
  it('defaults to INTEGRATIONS_MODE', async () => {
    expect((await load()).isWhatsAppLive()).toBe(false);
  });

  it('WA_MODE=live needs the WhatsApp keys, and only those', async () => {
    vi.stubEnv('WA_MODE', 'live');
    await expect(load()).rejects.toThrow('WA_ACCESS_TOKEN: required when WA is live');
    vi.resetModules();
    set(WA_KEYS, 'x');
    const { config, isWhatsAppLive } = await load();
    expect(isWhatsAppLive()).toBe(true);
    expect(config.INTEGRATIONS_MODE).toBe('fake');
  });

  it('INTEGRATIONS_MODE=live still needs Razorpay and Zoom, but WA_MODE=fake excuses WhatsApp', async () => {
    vi.stubEnv('INTEGRATIONS_MODE', 'live');
    vi.stubEnv('WA_MODE', 'fake');
    await expect(load()).rejects.toThrow('ZOOM_CLIENT_ID: required when INTEGRATIONS_MODE=live');
    vi.resetModules();
    set(OTHER_KEYS, 'x');
    expect((await load()).isWhatsAppLive()).toBe(false);
  });

  it('INTEGRATIONS_MODE=live without WA_MODE keeps WhatsApp live too', async () => {
    vi.stubEnv('INTEGRATIONS_MODE', 'live');
    set(OTHER_KEYS, 'x');
    await expect(load()).rejects.toThrow('WA_PHONE_NUMBER_ID: required when WA is live');
  });

  it('links are fake only with live WhatsApp and fake Zoom/Razorpay', async () => {
    expect((await load()).linksAreFake()).toBe(false); // all fake: simulators only
    vi.resetModules();
    vi.stubEnv('WA_MODE', 'live');
    set(WA_KEYS, 'x');
    expect((await load()).linksAreFake()).toBe(true);
    vi.resetModules();
    vi.stubEnv('INTEGRATIONS_MODE', 'live');
    set(OTHER_KEYS, 'x');
    expect((await load()).linksAreFake()).toBe(false);
  });
});
