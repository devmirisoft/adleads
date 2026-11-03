import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveWhatsApp } from '@/lib/whatsapp/live';
import { WhatsAppApiError, WhatsAppLimitError } from '@/lib/whatsapp/types';

// Runs before the imports above, which read the env once.
vi.hoisted(() => {
  process.env.WA_PHONE_NUMBER_ID = 'PNID';
  process.env.WA_ACCESS_TOKEN = 'secret-token';
});

const to = '919812345678';

function stubGraph(status: number, body: string) {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(body, { status }),
  );
  vi.stubGlobal('fetch', fetch);
  return () => {
    const [url, init] = fetch.mock.calls[0];
    return { url, headers: init.headers, body: JSON.parse(String(init.body)) as unknown };
  };
}
const ok = () => stubGraph(200, JSON.stringify({ messages: [{ id: 'wamid.REAL' }] }));

afterEach(() => vi.unstubAllGlobals());

describe('live WhatsApp client', () => {
  it('posts a text to the Cloud API and returns the wamid', async () => {
    const sent = ok();
    await expect(liveWhatsApp.sendText(to, 'Hi')).resolves.toEqual({ waMessageId: 'wamid.REAL' });
    expect(sent().url).toBe('https://graph.facebook.com/v26.0/PNID/messages');
    expect(sent().headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    expect(sent().body).toEqual({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: 'Hi' },
    });
  });

  it('builds reply buttons and lists', async () => {
    let sent = ok();
    await liveWhatsApp.sendButtons(to, { body: 'Pick', buttons: [{ id: 'a', title: 'A' }] });
    expect(sent().body).toMatchObject({
      interactive: {
        type: 'button',
        body: { text: 'Pick' },
        action: { buttons: [{ type: 'reply', reply: { id: 'a', title: 'A' } }] },
      },
    });
    sent = ok();
    const rows = [{ id: 'r', title: 'Row', description: 'More' }];
    await liveWhatsApp.sendList(to, { body: 'Pick', button: 'Open', rows });
    expect(sent().body).toMatchObject({
      interactive: { type: 'list', action: { button: 'Open', sections: [{ rows }] } },
    });
  });

  it('sends template params, and no components when there are none', async () => {
    let sent = ok();
    await liveWhatsApp.sendTemplate(to, 'trial_ended', 'en', ['Rahul']);
    expect(sent().body).toMatchObject({
      template: {
        name: 'trial_ended',
        language: { code: 'en' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Rahul' }] }],
      },
    });
    sent = ok();
    await liveWhatsApp.sendTemplate(to, 'hello_world', 'en', []);
    expect(sent().body).toEqual({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en' } },
    });
  });

  it('turns a Graph error into "<code>: <title>" with phone numbers masked', async () => {
    stubGraph(
      400,
      JSON.stringify({
        error: { code: 131030, message: `(#131030) Recipient ${to} not in allowed list` },
      }),
    );
    const e = await liveWhatsApp.sendText(to, 'Hi').catch((err: unknown) => err);
    expect(e).toBeInstanceOf(WhatsAppApiError);
    expect((e as Error).message).toBe('131030: Recipient *** not in allowed list');
  });

  it('reports the HTTP status when the body is not Graph JSON', async () => {
    stubGraph(502, '<html>Bad gateway</html>');
    await expect(liveWhatsApp.sendText(to, 'Hi')).rejects.toThrow('HTTP 502: No details from Meta');
  });

  it('marks a message read with exactly the payload Meta documents', async () => {
    const sent = stubGraph(200, JSON.stringify({ success: true }));
    await expect(liveWhatsApp.markRead('wamid.IN')).resolves.toBeUndefined();
    expect(sent().url).toBe('https://graph.facebook.com/v26.0/PNID/messages');
    expect(sent().body).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.IN',
    });
  });

  it('adds the typing indicator to the same read call', async () => {
    const sent = stubGraph(200, JSON.stringify({ success: true }));
    await liveWhatsApp.markRead('wamid.IN', { typing: true });
    expect(sent().body).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.IN',
      typing_indicator: { type: 'text' },
    });
  });

  it('reports a failed read receipt with phone numbers masked', async () => {
    stubGraph(400, JSON.stringify({ error: { code: 100, message: `Bad id for ${to}` } }));
    await expect(liveWhatsApp.markRead('wamid.IN')).rejects.toThrow('100: Bad id for ***');
  });

  it('treats a send Meta accepted without a message id as a failure', async () => {
    stubGraph(200, JSON.stringify({ success: true }));
    await expect(liveWhatsApp.sendText(to, 'Hi')).rejects.toBeInstanceOf(WhatsAppApiError);
  });

  it('enforces the limits before calling Meta', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(liveWhatsApp.sendText(to, '')).rejects.toBeInstanceOf(WhatsAppLimitError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
