'use server';
import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { CAN_ACT, guarded } from '@/modules/auth';
import { MANUAL_STATUS_TARGETS, type LeadStatus } from '../constants/statuses';
import { transition } from './transition';

const id = z.uuid();

/** Bulk-assign leads to a staff member (or unassign with null). */
export async function assignLeads(leadIds: string[], userId: string | null) {
  return guarded(CAN_ACT, async () => {
    const ids = z.array(id).min(1, 'Select at least one lead').max(500).parse(leadIds);
    if (userId) {
      const user = await db.user.findUnique({ where: { id: id.parse(userId) } });
      if (!user?.isActive) throw new Error('That staff member is inactive.');
    }
    const { count } = await db.lead.updateMany({
      where: { id: { in: ids } },
      data: { assignedToId: userId },
    });
    return count;
  });
}

/** Clear "needs a human" and mark their messages read, so the lead leaves the inbox. */
export async function resolveLead(leadId: string) {
  return guarded(CAN_ACT, async () => {
    const lid = id.parse(leadId);
    await db.$transaction([
      db.lead.update({ where: { id: lid }, data: { needsHuman: false } }),
      db.message.updateMany({
        where: { leadId: lid, direction: 'IN', status: { not: 'READ' } },
        data: { status: 'READ' },
      }),
    ]);
    return null;
  });
}

export async function updateNotes(leadId: string, notes: string) {
  return guarded(CAN_ACT, async () => {
    const text = z.string().max(5000, 'Keep notes under 5,000 characters').parse(notes).trim();
    await db.lead.update({ where: { id: id.parse(leadId) }, data: { notes: text || null } });
    return null;
  });
}

/**
 * Staff status change. Only statuses with no side effects; trial, payment, enrolled and
 * expired go through their own actions (assign batch, request payment, mark paid…).
 */
export async function changeStatus(leadId: string, to: LeadStatus, note?: string) {
  return guarded(CAN_ACT, async (user) => {
    const lid = id.parse(leadId);
    if (!MANUAL_STATUS_TARGETS.includes(to)) {
      throw new Error(
        'That status is set by its own action (assign batch, request payment, mark paid).',
      );
    }
    if (to === 'CANCELLED') {
      const live = await db.enrollment.count({
        where: { leadId: lid, status: { in: ['TRIAL', 'PAID'] } },
      });
      if (live) throw new Error('This lead has a live enrollment — cancel the enrollment instead.');
    }
    await transition(lid, to, { actor: user.id, note: note?.trim() || 'Changed by staff' });
    return null;
  });
}
