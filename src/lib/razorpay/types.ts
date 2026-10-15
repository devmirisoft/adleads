// Razorpay adapter contract.

export type PaymentLinkInput = {
  amountPaise: number;
  /** Our Payment id — comes back in webhooks as payment_link.entity.reference_id. */
  referenceId: string;
  customer: { name: string; contact: string; email?: string };
  expireBy: Date;
};

export interface RazorpayClient {
  createPaymentLink(input: PaymentLinkInput): Promise<{ id: string; shortUrl: string }>;
}
