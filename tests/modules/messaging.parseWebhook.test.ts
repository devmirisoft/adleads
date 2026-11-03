import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { metaEventKey, parseMetaWebhook } from '@/modules/messaging/services/parseWebhook';
import { buildMetaPayload } from '@/modules/messaging/utils/metaPayload';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/meta/${name}.json`, import.meta.url), 'utf8'));

describe('parseMetaWebhook', () => {
  it('parses text with an ad referral', () => {
    const { messages, statuses } = parseMetaWebhook(fixture('text_with_referral'));
    expect(statuses).toEqual([]);
    expect(messages).toEqual([
      {
        waId: '919812345678',
        phone: '+919812345678',
        profileName: 'Rahul Sharma',
        messageId: 'wamid.HBgMOTE5ODEyMzQ1Njc4FQIAEhggQUJDMTIz',
        timestamp: new Date(1792058400 * 1000),
        kind: 'text',
        text: 'Hi! I want to know more about this.',
        referral: {
          adId: '120210000000001',
          headline: 'Spoken English – Reel 1',
          ctwaClid: expect.stringMatching(/^ARAk/),
        },
      },
    ]);
  });

  it('parses button, list and template quick-reply taps', () => {
    const [button] = parseMetaWebhook(fixture('button_reply')).messages;
    expect(button).toMatchObject({ kind: 'button', replyId: 'confirm', text: 'Confirm' });
    const [list] = parseMetaWebhook(fixture('list_reply')).messages;
    expect(list).toMatchObject({
      kind: 'list',
      replyId: '00000000-0000-4000-8000-000000000c01',
      text: 'Spoken English',
    });
    const [quick] = parseMetaWebhook(fixture('template_quick_reply')).messages;
    expect(quick).toMatchObject({ kind: 'button', replyId: 'book_seat', phone: '+919810000011' });
  });

  it('parses delivery statuses with error codes', () => {
    expect(parseMetaWebhook(fixture('statuses')).statuses).toEqual([
      { waMessageId: 'wamid.OUTBOUND1', status: 'DELIVERED' },
      {
        waMessageId: 'wamid.OUTBOUND2',
        status: 'FAILED',
        errorCode: '131047: Re-engagement message',
      },
    ]);
  });

  it('walks every entry and change, skipping non-message fields; unknown types become "other"', () => {
    const { messages, statuses } = parseMetaWebhook(fixture('multi_entry'));
    expect(messages.map((m) => [m.messageId, m.kind, m.profileName])).toEqual([
      ['wamid.M1', 'text', 'Aarav'],
      ['wamid.M2', 'other', 'Meera'],
    ]);
    expect(statuses).toEqual([{ waMessageId: 'wamid.OUT9', status: 'READ' }]);
  });

  const webhook = (value: unknown, field = 'messages') => ({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field, value }] }],
  });
  const text = (extra: object) => ({
    id: 'wamid.X',
    timestamp: '1792058400',
    type: 'text',
    text: { body: 'hi' },
    ...extra,
  });

  it('keeps a wa_id as sent, even when it looks like a bare Indian mobile', () => {
    const { messages } = parseMetaWebhook(webhook({ messages: [text({ from: '6591234567' })] }));
    expect(messages[0].phone).toBe('+6591234567');
  });

  it('finds the sender of a message without `from` through contacts[].user_id', () => {
    const { messages, notes } = parseMetaWebhook(
      webhook({
        contacts: [{ user_id: 'IN.1', wa_id: '919810000001', profile: { name: 'Aarav' } }],
        messages: [text({ from_user_id: 'IN.1' })],
      }),
    );
    expect(messages[0]).toMatchObject({ phone: '+919810000001', profileName: 'Aarav' });
    expect(notes).toEqual([]);
  });

  it('notes a username-only sender instead of failing, and keeps the rest of the batch', () => {
    const { messages, notes } = parseMetaWebhook(
      webhook({
        contacts: [{ user_id: 'IN.1', profile: { name: 'No number' } }],
        messages: [
          text({ id: 'wamid.A', from_user_id: 'IN.1' }),
          { garbage: true },
          text({ id: 'wamid.B', from: '919810000002' }),
        ],
      }),
    );
    expect(messages.map((m) => m.messageId)).toEqual(['wamid.B']);
    expect(notes).toEqual([
      'Skipped a message with no usable phone number',
      'Skipped a malformed message',
    ]);
  });

  it('notes other fields whatever their shape, and tolerates missing contacts', () => {
    expect(parseMetaWebhook(webhook({ contacts: 'not a list' }, 'calls'))).toEqual({
      messages: [],
      statuses: [],
      notes: ['Ignored field: calls'],
    });
    const { messages } = parseMetaWebhook(webhook({ messages: [text({ from: '919810000001' })] }));
    expect(messages).toHaveLength(1);
  });

  it('a referral in an unexpected shape does not lose the message', () => {
    const { messages } = parseMetaWebhook(
      webhook({ messages: [text({ from: '919810000001', referral: { headline: 'no id' } })] }),
    );
    expect(messages[0]).toMatchObject({ text: 'hi' });
    expect(messages[0].referral).toBeUndefined();
  });

  it('rejects payloads that are not WhatsApp webhooks', () => {
    expect(() => parseMetaWebhook({ object: 'page', entry: [] })).toThrow();
  });

  it('round-trips the simulator payload builder', () => {
    const payload = buildMetaPayload({
      waId: '919812345678',
      profileName: 'Rahul',
      message: { kind: 'list', id: 'b1', title: 'Evening' },
      messageId: 'wamid.SIM1',
    });
    expect(parseMetaWebhook(payload).messages[0]).toMatchObject({
      kind: 'list',
      replyId: 'b1',
      messageId: 'wamid.SIM1',
    });
  });
});

describe('metaEventKey', () => {
  it('keys on message/status ids so redeliveries dedupe, else on the body hash', () => {
    const payload = fixture('multi_entry');
    expect(metaEventKey(payload, '')).toBe('meta:wamid.M1,wamid.M2,wamid.OUT9:READ');
    expect(metaEventKey({ object: 'page' }, 'x')).toMatch(/^meta:sha256:[0-9a-f]{64}$/);
  });

  it('gives two senders different keys and hashes a batch too long for the unique index', () => {
    const batch = (ids: string[]) => ({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: ids.map((id) => ({
                  from: '919810000001',
                  id,
                  timestamp: '1',
                  type: 'text',
                })),
              },
            },
          ],
        },
      ],
    });
    expect(metaEventKey(batch(['wamid.A']), 'same')).not.toBe(
      metaEventKey(batch(['wamid.B']), 'same'),
    );
    const many = Array.from({ length: 50 }, (_, i) => `wamid.${'x'.repeat(70)}${i}`);
    expect(metaEventKey(batch(many), '')).toMatch(/^meta:sha256:[0-9a-f]{64}$/);
    expect(metaEventKey(batch(many), '')).not.toBe(metaEventKey(batch(many.slice(1)), ''));
  });
});
