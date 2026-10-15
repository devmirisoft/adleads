import { describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/modules/core/utils/money';
import { formatPhone } from '../../src/modules/core/utils/phone';
import { formatDateTime, formatRelative } from '../../src/modules/core/utils/dates';

describe('core formatters', () => {
  it('formats paise as rupees with Indian grouping', () => {
    expect(formatMoney(299900)).toBe('₹2,999.00');
    expect(formatMoney(14_99_500_00)).toBe('₹14,99,500.00');
  });

  it('formats Indian E.164 numbers and passes others through', () => {
    expect(formatPhone('+919812345678')).toBe('+91 98123 45678');
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });

  it('shows UTC times in IST', () => {
    expect(formatDateTime('2026-10-14T11:00:00Z')).toBe('14 Oct 2026, 4:30 PM');
  });

  it('formats relative times', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(formatRelative('2026-10-14T11:59:30Z', now)).toBe('just now');
    expect(formatRelative('2026-10-14T11:55:00Z', now)).toBe('5 min ago');
    expect(formatRelative('2026-10-14T10:00:00Z', now)).toBe('2 h ago');
    expect(formatRelative('2026-10-11T12:00:00Z', now)).toBe('3 d ago');
    expect(formatRelative('2026-09-01T12:00:00Z', now)).toBe('1 Sep 2026');
  });
});
