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
  'Your class link on WhatsApp',
  'Class reminders on WhatsApp',
  'Pay by UPI, card or net banking (Razorpay)',
];

// Keep in step with the courses on Bot script → Courses (same names and fees).
export const plans: Plan[] = [
  {
    name: '1 month',
    pricePaise: 49_900,
    period: 'for 1 month',
    note: 'One month of live classes.',
  },
  {
    name: '3 months + gift',
    pricePaise: 149_900,
    period: 'for 3 months',
    note: 'Three months of live classes, plus a free gift.',
  },
  {
    name: '6 months + gift',
    pricePaise: 249_900,
    period: 'for 6 months',
    note: 'Six months of live classes, plus a free gift.',
  },
  {
    name: '1 year + gift',
    pricePaise: 349_900,
    period: 'for 12 months',
    note: 'A full year of live classes, plus a free gift.',
    // Lowest price per month of the four (₹292 vs ₹499, ₹500, ₹417).
    badge: 'Best value',
  },
];
