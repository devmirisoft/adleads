export const JOB_TYPES = [
  'processWebhook',
  'sendMessage',
  'zoomRegister',
  'zoomCancel',
  'createPaymentLink',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

/**
 * One handler per job type; it parses its own payload. The map is wired in the app layer
 * (src/app/_jobs/handlers.ts) so this module never imports feature modules.
 */
export type JobHandlers = Record<JobType, (payload: unknown) => Promise<void>>;

export type RunResult = { done: number; failed: { id: string; type: string; error: string }[] };
