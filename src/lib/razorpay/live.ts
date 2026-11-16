import 'server-only';
import Razorpay from 'razorpay';
import { config } from '../config';
import type { RazorpayClient } from './types';

export const liveRazorpay: RazorpayClient = {
  async createPaymentLink({ amountPaise, referenceId, customer, expireBy }) {
    // Built per call: this file is imported in fake mode too, where the keys are unset
    // and the constructor would throw. Config guarantees both keys when INTEGRATIONS_MODE=live.
    const rzp = new Razorpay({
      key_id: config.RAZORPAY_KEY_ID!,
      key_secret: config.RAZORPAY_KEY_SECRET!,
    });
    try {
      const link = await rzp.paymentLink.create({
        amount: amountPaise,
        currency: 'INR',
        reference_id: referenceId,
        customer,
        notify: { sms: false, email: false }, // we send the link on WhatsApp ourselves
        expire_by: Math.floor(expireBy.getTime() / 1000), // Razorpay: at least 15 min ahead
        reminder_enable: false,
      });
      return { id: link.id, shortUrl: link.short_url };
    } catch (e) {
      // The SDK rejects with a plain `{ statusCode, error: { description } }`, not an Error,
      // so staff would only see the generic message without this.
      const reason = (e as { error?: { description?: string } }).error?.description;
      throw new Error(
        `Razorpay couldn't create the payment link${reason ? `: ${reason}` : ''}. Try again, or record a manual payment.`,
      );
    }
  },
};
