import 'server-only';
import { config } from '../config';
import { createFakeRazorpay } from './fake';
import { liveRazorpay } from './live';
import type { RazorpayClient } from './types';

export const razorpay: RazorpayClient =
  config.INTEGRATIONS_MODE === 'live'
    ? liveRazorpay
    : createFakeRazorpay(config.NEXTAUTH_URL ?? 'http://localhost:3000');

export { verifyRazorpaySignature } from './verify';
export type { PaymentLinkInput } from './types';
