import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/modules/messaging';
import { mergeMessages } from '@/modules/messaging/utils/mergeMessages';

const msg = (id: string, createdAt: string, status: ChatMessage['status'], updatedAt = createdAt) =>
  ({ id, createdAt, updatedAt, status }) as ChatMessage;

describe('mergeMessages', () => {
  const a = msg('a', '2026-11-03T10:00:00.000Z', 'SENT');

  it('adds new rows in createdAt order', () => {
    const b = msg('b', '2026-11-03T10:01:00.000Z', 'SENT');
    const merged = mergeMessages([b], [a]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('applies a status change to a row it already holds', () => {
    const read = msg('a', a.createdAt, 'READ', '2026-11-03T10:05:00.000Z');
    expect(mergeMessages([a], [read])).toEqual([read]);
  });

  it("doesn't let a late response undo a newer status", () => {
    const read = msg('a', a.createdAt, 'READ', '2026-11-03T10:05:00.000Z');
    expect(mergeMessages([read], [a])).toEqual([read]);
  });

  it('returns the same array when nothing changed, so idle polls skip the re-render', () => {
    const current = [a];
    expect(mergeMessages(current, [])).toBe(current);
    expect(mergeMessages(current, [{ ...a }])).toBe(current);
  });
});
