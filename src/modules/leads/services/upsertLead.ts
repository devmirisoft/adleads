import 'server-only';
import { db, isUniqueViolation } from '@/lib/db';

const FREE_ENTRY_POINT_MS = 72 * 3_600_000; // CTWA ads open a 72 h free messaging window

/** The sender of an inbound WhatsApp message (messaging's InboundMessage satisfies this). */
export type InboundSender = {
  phone: string; // E.164
  waId: string;
  profileName?: string;
  referral?: { adId: string; ctwaClid?: string; headline?: string };
};

/**
 * Find or create the lead for an inbound message. On creation, store the ad referral
 * (CTWA_AD + 72 h free window) and log NEW. Always bumps lastInboundAt and resets nudges.
 */
export async function upsertLead(msg: InboundSender, at: Date) {
  const touch = {
    waId: msg.waId,
    lastInboundAt: at,
    remindersSent: 0,
    ...(msg.profileName && { profileName: msg.profileName }),
  };
  const existing = await db.lead.findUnique({ where: { phoneE164: msg.phone } });
  if (existing) return db.lead.update({ where: { id: existing.id }, data: touch });

  try {
    return await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          phoneE164: msg.phone,
          ...touch,
          ...(msg.referral
            ? {
                source: 'CTWA_AD',
                adId: msg.referral.adId,
                // Meta's referral has no ad name; the ad headline is the closest human label.
                adName: msg.referral.headline,
                ctwaClid: msg.referral.ctwaClid,
                freeWindowUntil: new Date(at.getTime() + FREE_ENTRY_POINT_MS),
              }
            : { source: 'ORGANIC' }),
        },
      });
      await tx.leadEvent.create({ data: { leadId: lead.id, toStatus: 'NEW', actor: 'webhook' } });
      return lead;
    });
  } catch (e) {
    // Two first messages raced; the other one created the lead.
    if (isUniqueViolation(e))
      return db.lead.update({ where: { phoneE164: msg.phone }, data: touch });
    throw e;
  }
}
