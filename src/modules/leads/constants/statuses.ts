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

/**
 * Where a lead got to: the leads "Stage" filter and the dashboard's courses table. Each status is in
 * at most one stage (CANCELLED is in none). OPTED_OUT can only happen before a trial.
 */
export const LEAD_STAGES = {
  no_join: {
    label: 'No join',
    statuses: ['NEW', 'ASKING', 'QUALIFIED', 'WAITLISTED', 'DROPPED', 'OPTED_OUT'],
  },
  on_trial: { label: 'On trial', statuses: ['TRIAL_ACTIVE', 'PAYMENT_PENDING'] },
  trial_unpaid: { label: 'Trial ended, not paid', statuses: ['EXPIRED'] },
  paid: { label: 'Joined and paid', statuses: ['ENROLLED'] },
} as const satisfies Record<string, { label: string; statuses: readonly LeadStatus[] }>;
export type LeadStage = keyof typeof LEAD_STAGES;
export const LEAD_STAGE_KEYS = Object.keys(LEAD_STAGES) as LeadStage[];

export const CALLED_LABEL = { yes: 'Called', no: 'Not called' } as const;

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
