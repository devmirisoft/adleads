'use server';
import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { CAN_ACT, guarded } from '@/modules/auth';
import { transition } from '@/modules/leads';
import { assignSeat, moveBatch } from './assignSeat';
import { cancel } from './cancel';
import { sendTrialLink } from './sendTrialLink';
import { extendTrial } from './trial';

const id = z.uuid();
const batchIdSchema = z.uuid('Pick a batch');

/** Staff books a seat for a lead who didn't finish the bot (ASKING), or is QUALIFIED / WAITLISTED. */
export async function assignBatchAction(leadId: string, batchId: string) {
  return guarded(CAN_ACT, async (user) => {
    const lid = id.parse(leadId);
    const bid = batchIdSchema.parse(batchId);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: lid } });
    if (lead.status === 'ASKING') {
      await transition(lid, 'QUALIFIED', { actor: user.id, note: 'Batch assigned by staff' });
    } else if (lead.status !== 'QUALIFIED' && lead.status !== 'WAITLISTED') {
      throw new Error('Only leads still asking, qualified or waitlisted can be given a batch.');
    }
    const res = await assignSeat(lid, bid, { actor: user.id });
    if (res.result === 'waitlisted')
      throw new Error('That batch just filled up — the lead is waitlisted.');
    return res.enrollmentId;
  });
}

export async function extendTrialAction(enrollmentId: string, days: number) {
  return guarded(CAN_ACT, async () => {
    const e = await extendTrial(id.parse(enrollmentId), z.number().int().parse(days));
    return e.trialEnd;
  });
}

export async function moveBatchAction(enrollmentId: string, batchId: string) {
  return guarded(CAN_ACT, async () => {
    await moveBatch(id.parse(enrollmentId), batchIdSchema.parse(batchId));
    return null;
  });
}

export async function cancelEnrollmentAction(enrollmentId: string, reason: string) {
  return guarded(CAN_ACT, async (user) => {
    await cancel(id.parse(enrollmentId), reason.trim() || 'Cancelled by staff', { actor: user.id });
    return null;
  });
}

/** Registers on Zoom if needed and re-sends the personal link. */
export async function resendTrialLinkAction(enrollmentId: string) {
  return guarded(CAN_ACT, async () => {
    await sendTrialLink(id.parse(enrollmentId));
    return null;
  });
}
