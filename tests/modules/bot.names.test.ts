import { describe, expect, it } from 'vitest';
import { isNotAName, pickOption } from '../../src/modules/bot/utils';

describe('bot list answers', () => {
  const items = [
    { id: 'a', name: 'Evening Mon–Fri' },
    { id: 'b', name: 'Morning Mon–Fri' },
    { id: 'c', name: 'Weekend' },
  ];
  const pick = (msg: { text?: string; replyId?: string }) => pickOption(items, msg)?.id;

  it.each([
    [{ replyId: 'b' }, 'b'],
    [{ text: 'weekend' }, 'c'],
    [{ text: '2' }, 'b'],
    [{ text: 'the evening batch pls' }, 'a'],
    [{ text: 'Mon–Fri' }, undefined], // two options match
    [{ text: '9' }, undefined],
    [{ text: 'ok' }, undefined],
    [{ replyId: 'gone-row', text: 'Weekend' }, undefined], // a tapped old row never fuzzy-matches
  ])('%o → %s', (msg, id) => expect(pick(msg)).toBe(id));
});

describe('bot name check', () => {
  it.each(['Hi', 'Hei', 'hiii', 'Heyyy', 'HELLO', 'Aloha', 'Namaste', 'Good morning', 'Hello sir'])(
    'rejects %s',
    (text) => expect(isNotAName(text)).toBe(true),
  );

  it.each(['Rahul Sharma', 'Aditya', 'Hiten', 'Heidi', 'Hai Nguyen', 'राहुल शर्मा'])(
    'accepts %s',
    (text) => expect(isNotAName(text)).toBe(false),
  );
});
