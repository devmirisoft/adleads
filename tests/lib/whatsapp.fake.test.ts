import { describe, expect, it } from 'vitest';
import { fakeWhatsApp } from '@/lib/whatsapp/fake';
import { WhatsAppLimitError } from '@/lib/whatsapp/types';

const to = '919812345678';
const x = (n: number) => 'x'.repeat(n);
const buttons = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `b${i}`, title: `Button ${i}` }));
const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, title: `Row ${i}` }));

describe('fake WhatsApp client', () => {
  it('returns a fake wamid for valid messages', async () => {
    const { waMessageId } = await fakeWhatsApp.sendText(to, 'Hi');
    expect(waMessageId).toMatch(/^wamid\.fake\.[0-9a-f-]{36}$/);
    await expect(
      fakeWhatsApp.sendButtons(to, { body: 'Pick', buttons: buttons(3) }),
    ).resolves.toBeDefined();
    await expect(
      fakeWhatsApp.sendList(to, {
        body: 'Pick',
        button: 'Choose',
        rows: [...rows(9), { id: 'r9', title: x(24), description: x(72) }],
      }),
    ).resolves.toBeDefined();
    await expect(
      fakeWhatsApp.sendTemplate(to, 'trial_ended', 'en', ['Rahul']),
    ).resolves.toBeDefined();
  });

  it('rejects text outside 1–4096 characters', async () => {
    await expect(fakeWhatsApp.sendText(to, '')).rejects.toThrow(WhatsAppLimitError);
    await expect(fakeWhatsApp.sendText(to, x(4097))).rejects.toThrow(WhatsAppLimitError);
    await expect(fakeWhatsApp.sendText(to, x(4096))).resolves.toBeDefined();
  });

  it('enforces button limits', async () => {
    const send = (msg: Parameters<typeof fakeWhatsApp.sendButtons>[1]) =>
      fakeWhatsApp.sendButtons(to, msg);
    await expect(send({ body: 'Pick', buttons: [] })).rejects.toThrow('1–3 buttons');
    await expect(send({ body: 'Pick', buttons: buttons(4) })).rejects.toThrow('1–3 buttons');
    await expect(send({ body: 'Pick', buttons: [{ id: 'a', title: x(21) }] })).rejects.toThrow(
      'title',
    );
    await expect(
      send({ body: 'Pick', buttons: [{ id: 'a', title: x(20) }] }),
    ).resolves.toBeDefined();
    await expect(send({ body: x(1025), buttons: buttons(1) })).rejects.toThrow('Body');
    await expect(
      send({
        body: 'Pick',
        buttons: [
          { id: 'a', title: 'One' },
          { id: 'a', title: 'Two' },
        ],
      }),
    ).rejects.toThrow('ids must be unique');
  });

  it('enforces list limits', async () => {
    const send = (msg: Parameters<typeof fakeWhatsApp.sendList>[1]) =>
      fakeWhatsApp.sendList(to, msg);
    await expect(send({ body: 'Pick', button: 'Choose', rows: rows(11) })).rejects.toThrow(
      '1–10 list rows',
    );
    await expect(send({ body: 'Pick', button: 'Choose', rows: [] })).rejects.toThrow(
      '1–10 list rows',
    );
    await expect(
      send({ body: 'Pick', button: 'Choose', rows: [{ id: 'a', title: x(25) }] }),
    ).rejects.toThrow('title');
    await expect(
      send({ body: 'Pick', button: 'Choose', rows: [{ id: 'a', title: 'A', description: x(73) }] }),
    ).rejects.toThrow('description');
    await expect(send({ body: 'Pick', button: x(21), rows: rows(1) })).rejects.toThrow(
      'List button',
    );
  });

  it('rejects malformed template names and languages', async () => {
    await expect(fakeWhatsApp.sendTemplate(to, 'Trial Ended', 'en', [])).rejects.toThrow(
      WhatsAppLimitError,
    );
    await expect(fakeWhatsApp.sendTemplate(to, 'trial_ended', 'english', [])).rejects.toThrow(
      WhatsAppLimitError,
    );
    await expect(fakeWhatsApp.sendTemplate(to, 'trial_ended', 'en_US', [])).resolves.toBeDefined();
  });
});
