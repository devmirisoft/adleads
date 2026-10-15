import { beforeAll, describe, expect, it } from 'vitest';
import {
  canTransition,
  IllegalTransitionError,
  LEAD_STATUS,
  transition,
  type LeadStatus,
} from '@/modules/leads';
import { db, hasTestDb, makeLead, resetDb } from '../helpers/db';

const pairs = LEAD_STATUS.flatMap((from) => LEAD_STATUS.map((to) => [from, to] as const));

describe.skipIf(!hasTestDb)('transition()', () => {
  beforeAll(resetDb);

  it.each(pairs.filter(([f, t]) => canTransition(f, t)))(
    '%s → %s is allowed and logged',
    async (from, to) => {
      const lead = await makeLead(from);
      await transition(lead.id, to, { actor: 'test', note: 'n' });
      const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(after.status).toBe(to);
      expect(!!after.optedOutAt).toBe(to === 'OPTED_OUT');
      const events = await db.leadEvent.findMany({ where: { leadId: lead.id } });
      expect(events).toMatchObject([{ fromStatus: from, toStatus: to, actor: 'test', note: 'n' }]);
    },
  );

  it.each(pairs.filter(([f, t]) => !canTransition(f, t)))(
    '%s → %s is rejected, nothing written',
    async (from, to) => {
      const lead = await makeLead(from);
      await expect(transition(lead.id, to as LeadStatus, { actor: 'test' })).rejects.toThrow(
        IllegalTransitionError,
      );
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(from);
      expect(await db.leadEvent.count({ where: { leadId: lead.id } })).toBe(0);
    },
  );

  it('terminal statuses have no way out', () => {
    expect(
      LEAD_STATUS.filter((t) => canTransition('OPTED_OUT', t) || canTransition('CANCELLED', t)),
    ).toEqual([]);
  });
});
