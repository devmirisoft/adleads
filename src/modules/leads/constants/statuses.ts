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
