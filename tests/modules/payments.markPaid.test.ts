import { beforeEach, describe, expect, it } from 'vitest';
import { assignSeat, expire, sendTrialLink } from '@/modules/enrollments';
import { recordWebhook } from '@/modules/jobs';
import { handleRazorpayEvent, markPaid, requestPayment } from '@/modules/payments';
import { db, hasTestDb, makeLead, PAID_LINK, resetDb, seedBasics, TRIAL_LINK } from '../helpers/db';

const FEE = 299_900;

/** A lead on a TRIAL with its trial link and an open Razorpay payment link. */
async function trialWithLink(capacity = 5) {
  const { batch } = await seedBasics({ capacity });
  const lead = await makeLead('QUALIFIED');
  const res = await assignSeat(lead.id, batch.id, { actor: 'test' });
  if (res.result !== 'trial') throw new Error('expected a seat');
  await sendTrialLink(res.enrollmentId);
  const payment = await requestPayment(res.enrollmentId, { actor: 'test' });
  return { batch, lead, enrollmentId: res.enrollmentId, payment };
}

const paidEvent = (linkId: string, payId: string, amount = FEE) => ({
  event: 'payment_link.paid',
  payload: {
    payment_link: { entity: { id: linkId } },
    payment: { entity: { id: payId, amount } },
  },
});

describe.skipIf(!hasTestDb)('markPaid()', () => {
  beforeEach(resetDb);

  it('enrolls once; a duplicate webhook changes nothing', async () => {
    const { lead, enrollmentId, payment } = await trialWithLink();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(
      'PAYMENT_PENDING',
    );

    // Razorpay retries: same event key is stored once…
    const event = paidEvent(payment.razorpayLinkId!, 'pay_dup_1');
    expect(await recordWebhook('RAZORPAY', 'razorpay:evt_1', event)).toEqual({ duplicate: false });
    expect(await recordWebhook('RAZORPAY', 'razorpay:evt_1', event)).toEqual({ duplicate: true });
    // …and even if processed twice (different event ids, same payment), markPaid is idempotent.
    await handleRazorpayEvent(event);
    const sent = await db.message.count({ where: { leadId: lead.id } });
    await handleRazorpayEvent(event);
    expect(
      await markPaid({
        paymentId: payment.id,
        method: 'RAZORPAY',
        amountPaise: FEE,
        razorpayPaymentId: 'pay_dup_1',
        actor: 'test',
      }),
    ).toBe('duplicate');

    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('ENROLLED');
    expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
      status: 'PAID',
    });
    expect(await db.payment.count({ where: { status: 'PAID' } })).toBe(1);
    expect(await db.message.count({ where: { leadId: lead.id } })).toBe(sent); // no second confirmation
    expect(await db.leadEvent.count({ where: { leadId: lead.id, toStatus: 'ENROLLED' } })).toBe(1);
  });

  it('amount mismatch → needsHuman with a note, not enrolled', async () => {
    const { lead, payment } = await trialWithLink();
    const res = await markPaid({
      paymentId: payment.id,
      method: 'RAZORPAY',
      amountPaise: 100_000,
      razorpayPaymentId: 'pay_short',
      actor: 'test',
    });
    expect(res).toBe('needs_review');
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ status: 'PAYMENT_PENDING', needsHuman: true });
    expect(after.notes).toContain('₹1,000.00');
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'CREATED',
    );
  });

  it('sends the paid link via enrollment_confirmed and stores it in place of the trial link', async () => {
    const { lead, enrollmentId, payment } = await trialWithLink();
    expect(
      (await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).zoomJoinUrl,
    ).toBe(TRIAL_LINK);

    await handleRazorpayEvent(paidEvent(payment.razorpayLinkId!, 'pay_link'));

    expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
      status: 'PAID',
      zoomJoinUrl: PAID_LINK,
    });
    const confirmation = await db.message.findFirstOrThrow({
      where: { leadId: lead.id, templateName: 'enrollment_confirmed' },
    });
    expect(JSON.stringify(confirmation.body)).toContain(PAID_LINK);
  });

  it('no paid link → still enrolled, flagged with a note, and the trial link is not left stored', async () => {
    const { lead, enrollmentId, payment, batch } = await trialWithLink();
    await db.batch.update({ where: { id: batch.id }, data: { paidLink: null } });

    await handleRazorpayEvent(paidEvent(payment.razorpayLinkId!, 'pay_nolink'));

    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ status: 'ENROLLED', needsHuman: true });
    expect(after.notes).toContain(`Paid, but batch ${batch.name} has no paid link`);
    expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
      status: 'PAID',
      zoomJoinUrl: null,
    });
    expect(
      await db.message.count({ where: { leadId: lead.id, templateName: 'enrollment_confirmed' } }),
    ).toBe(0);
  });

  it('an opted-out lead is enrolled but sent nothing, so no link is stored as sent', async () => {
    const { lead, enrollmentId, payment } = await trialWithLink();
    await db.lead.update({ where: { id: lead.id }, data: { optedOutAt: new Date() } });

    await handleRazorpayEvent(paidEvent(payment.razorpayLinkId!, 'pay_optout'));

    expect(await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
      status: 'PAID',
      zoomJoinUrl: null,
    });
  });

  it('paid after EXPIRED → seat retaken, paid link sent, ENROLLED', async () => {
    const { lead, enrollmentId, payment, batch } = await trialWithLink();
    await expire(enrollmentId, { actor: 'test' });
    expect((await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).seatsTaken).toBe(0);

    await handleRazorpayEvent(paidEvent(payment.razorpayLinkId!, 'pay_late'));

    const after = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    expect(after.status).toBe('PAID');
    expect(after.zoomJoinUrl).toBe(PAID_LINK);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('ENROLLED');
    expect((await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).seatsTaken).toBe(1);
    const confirmation = await db.message.findFirstOrThrow({
      where: { leadId: lead.id, templateName: 'enrollment_confirmed' },
    });
    expect(JSON.stringify(confirmation.body)).toContain(PAID_LINK);
  });
});
