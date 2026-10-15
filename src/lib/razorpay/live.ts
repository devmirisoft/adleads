import 'server-only';
import type { RazorpayClient } from './types';

// TODO(live): Razorpay Payment Links, using config.RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
// (the `razorpay` npm package is already installed: new Razorpay({ key_id, key_secret })).
//  - createPaymentLink: razorpay.paymentLink.create({
//      amount: amountPaise, currency: "INR", reference_id: referenceId,
//      customer: { name, contact, email }, notify: { sms: false, email: false },
//      expire_by: Math.floor(expireBy.getTime() / 1000), reminder_enable: false })
//    → { id, shortUrl: short_url }
//  - expire_by must be ≥ 15 min ahead; reference_id must be unique per link.
const notImplemented = (): never => {
  throw new Error('Not implemented: live Razorpay adapter');
};

export const liveRazorpay: RazorpayClient = {
  createPaymentLink: notImplemented,
};
