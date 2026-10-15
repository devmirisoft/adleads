import { randomBytes } from 'node:crypto';
import type { RazorpayClient } from './types';

/** Links point at the /dev/pay checkout simulator on this app. */
export function createFakeRazorpay(appUrl: string): RazorpayClient {
  return {
    async createPaymentLink({ amountPaise, expireBy }) {
      // Same rules Razorpay applies: positive whole paise, expiry in the future.
      if (!Number.isInteger(amountPaise) || amountPaise < 100) {
        throw new Error('Amount must be whole paise, at least ₹1');
      }
      if (expireBy.getTime() <= Date.now()) throw new Error('Link expiry must be in the future');
      const id = `plink_fake_${randomBytes(7).toString('hex')}`;
      return { id, shortUrl: new URL(`/dev/pay/${id}`, appUrl).toString() };
    },
  };
}
