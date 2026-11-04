import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { batchInputSchema, needsTrialLink } from '@/modules/batches';
import { StatusBadge } from '@/modules/core/components';

const valid = {
  courseId: '00000000-0000-4000-8000-000000000c01',
  name: 'Evening',
  daysOfWeek: [1],
  startTime: '19:00',
  endTime: '20:00',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  capacity: 5,
  zoomHostUser: 'host@zoom.example',
};
const link = (trialLink: unknown, paidLink?: unknown) =>
  batchInputSchema.safeParse({ ...valid, trialLink, paidLink });

describe('batch link validation', () => {
  it.each(['https://us02web.zoom.us/j/81000000001?pwd=abc', 'https://zoom.us/my/room'])(
    'accepts %s',
    (url) => {
      expect(link(url).success).toBe(true);
      expect(link(undefined, url).success).toBe(true);
    },
  );

  it('both links are optional, and blank means none', () => {
    expect(batchInputSchema.safeParse(valid).success).toBe(true);
    expect(link('', '').success).toBe(true);
  });

  it('trims what was pasted', () => {
    expect(link('  https://zoom.us/j/1 \n').data?.trialLink).toBe('https://zoom.us/j/1');
  });

  it.each([
    'http://zoom.us/j/1',
    'zoom.us/j/1',
    'javascript:alert(1)',
    'https:zoom.us/j/1',
    'https://',
    'https://zoom.us/j/1 and a note',
    'ftp://zoom.us/j/1',
  ])('rejects %s', (url) => {
    expect(link(url).success).toBe(false);
    expect(link(undefined, url).success).toBe(false);
  });

  it('caps links at 500 characters', () => {
    const at = (n: number) => `https://zoom.us/${'x'.repeat(n - 'https://zoom.us/'.length)}`;
    expect(at(500)).toHaveLength(500);
    expect(link(at(500)).success).toBe(true);
    expect(link(at(501)).success).toBe(false);
  });
});

describe('missing trial link warning', () => {
  it('shows while the batch takes trials, or will once a seat frees up', () => {
    expect(needsTrialLink({ status: 'OPEN', trialLink: null })).toBe(true);
    expect(needsTrialLink({ status: 'FULL', trialLink: null })).toBe(true);
  });

  it('not once a link is set, or on a closed batch', () => {
    expect(needsTrialLink({ status: 'OPEN', trialLink: 'https://zoom.us/j/1' })).toBe(false);
    expect(needsTrialLink({ status: 'CLOSED', trialLink: null })).toBe(false);
  });

  it('the badge says it in words, in the warning tone', () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: 'NO_TRIAL_LINK' }));
    expect(html).toContain('No trial link');
    expect(html).toContain('text-warning');
  });
});
