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
});
