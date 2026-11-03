import { describe, expect, it } from 'vitest';
import { isNotAName } from '../../src/modules/bot/utils';

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
