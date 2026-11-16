export const LEAD_STATUS = [
  'NEW',
  'ASKING',
  'QUALIFIED',
  'WAITLISTED',
  'TRIAL_ACTIVE',
  'PAYMENT_PENDING',
  'ENROLLED',
  'EXPIRED',
  'DROPPED',
  'OPTED_OUT',
  'CANCELLED',
] as const;

export type LeadStatus = (typeof LEAD_STATUS)[number];

/** The only legal status moves. transition() enforces this; the UI uses it to offer choices. */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['ASKING', 'OPTED_OUT'],
  ASKING: ['QUALIFIED', 'DROPPED', 'OPTED_OUT'],
  DROPPED: ['ASKING', 'OPTED_OUT'],
  // → ASKING: nothing is booked yet, so the lead can still CHANGE their answers.
  QUALIFIED: ['TRIAL_ACTIVE', 'WAITLISTED', 'ASKING'],
  WAITLISTED: ['TRIAL_ACTIVE', 'ASKING', 'OPTED_OUT', 'CANCELLED'],
  TRIAL_ACTIVE: ['PAYMENT_PENDING', 'ENROLLED', 'EXPIRED', 'CANCELLED'],
  PAYMENT_PENDING: ['ENROLLED', 'EXPIRED', 'CANCELLED'],
  EXPIRED: ['ENROLLED', 'CANCELLED'],
  ENROLLED: ['CANCELLED'],
  OPTED_OUT: [],
  CANCELLED: [],
};

export const SOURCE_LABEL = {
  CTWA_AD: 'Ad',
  LEAD_FORM: 'Lead form',
  ORGANIC: 'Organic',
  MANUAL: 'Manual',
} as const;

/** Statuses staff may set by hand ("Change status"); the rest come from their own actions. */
export const MANUAL_STATUS_TARGETS: readonly LeadStatus[] = [
  'ASKING',
  'QUALIFIED',
  'DROPPED',
  'WAITLISTED',
  'OPTED_OUT',
  'CANCELLED',
];

export const canTransition = (from: LeadStatus, to: LeadStatus) =>
  LEAD_TRANSITIONS[from].includes(to);

/** Leads-page age tabs, by when the lead first messaged. [min, max) in days; null = no upper end. */
export const LEAD_AGES = ['hot', '10d', '3m', '6m', '12m'] as const;
export type LeadAge = (typeof LEAD_AGES)[number];
export const AGE_LABEL: Record<LeadAge, string> = {
  hot: 'Hot (10 days)',
  '10d': '10 days–3 months',
  '3m': '3–6 months',
  '6m': '6–12 months',
  '12m': 'Over 12 months',
};
export const AGE_DAYS: Record<LeadAge, readonly [number, number | null]> = {
  hot: [0, 10],
  '10d': [10, 90],
  '3m': [90, 180],
  '6m': [180, 365],
  '12m': [365, null],
};
