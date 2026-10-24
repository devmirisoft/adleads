export type Plan = {
  name: string;
  /** Integer paise, like every amount in this app: ₹1,999 → 199_900. */
  pricePaise: number;
  period: string;
  note: string;
  /** Small label on the card, e.g. "Best value". Only say what's true. */
  badge?: string;
};

/** Free days before payment. Keep in step with "Default trial days" in Settings. */
export const freeTrialDays = 3;

/** true → "Prices include GST"; false → "GST is added at checkout". */
export const pricesIncludeGst = true;

/** Shown under the plans: what every plan gets. */
export const included = [
  'Every class in your batch, live on Zoom',
  'Your personal class link on WhatsApp',
  'Class reminders on WhatsApp',
  'Pay by UPI, card or net banking (Razorpay)',
];

// EXAMPLE prices: replace before launch.
export const plans: Plan[] = [
  {
    name: 'Monthly',
    pricePaise: 199_900,
    period: 'per month',
    note: 'Pay month to month.',
  },
  {
    name: 'Quarterly',
    pricePaise: 499_900,
    period: 'for 3 months',
    note: 'One payment for three months.',
    badge: 'Best value',
  },
];
