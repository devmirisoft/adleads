import { describe, expect, it } from 'vitest';
import { LEAD_AGES } from '../../src/modules/leads/constants/statuses';
import { ageRange } from '../../src/modules/leads/utils';
import { botMessageSchema, fillMessage } from '../../src/modules/settings/constants/messages';

const at = new Date('2026-11-14T12:00:00Z');
const daysAgo = (d: number) => new Date(at.getTime() - d * 86_400_000);
/** Which age tabs a lead created `d` days ago falls in. */
const tabsFor = (d: number) =>
  LEAD_AGES.filter((age) => {
    const { lte, gt } = ageRange(age, at);
    const created = daysAgo(d);
    return created <= lte && (!gt || created > gt);
  });

describe('lead age tabs', () => {
  it('every lead is in exactly one tab, with the edges going to the older tab', () => {
    expect(tabsFor(0)).toEqual(['hot']);
    expect(tabsFor(9.9)).toEqual(['hot']);
    expect(tabsFor(10)).toEqual(['10d']);
    expect(tabsFor(89)).toEqual(['10d']);
    expect(tabsFor(90)).toEqual(['3m']);
    expect(tabsFor(200)).toEqual(['6m']);
    expect(tabsFor(365)).toEqual(['12m']);
    expect(tabsFor(2000)).toEqual(['12m']);
  });
});

describe('bot messages', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(fillMessage('Hi {name}, {batch} {oops}', { name: 'Rahul', batch: 'Morning' })).toBe(
      'Hi Rahul, Morning {oops}',
    );
  });

  it('a link message must keep {link}', () => {
    expect(botMessageSchema.safeParse({ key: 'msg_trial_link', text: 'Welcome!' }).success).toBe(
      false,
    );
    expect(
      botMessageSchema.safeParse({ key: 'msg_trial_link', text: 'Join here: {link}' }).success,
    ).toBe(true);
    expect(botMessageSchema.safeParse({ key: 'msg_stuck', text: 'Reply HELP' }).success).toBe(true);
  });
});
