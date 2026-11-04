export const JOB_TYPES = ['processWebhook', 'sendMessage', 'sendTrialLink'] as const;
export type JobType = (typeof JOB_TYPES)[number];

/** Nothing can enqueue these any more, but old rows may still be in `jobs` and must not fail. */
type RetiredJobType = 'zoomRegister' | 'zoomCancel';

/**
 * One handler per job type; it parses its own payload. The map is wired in the app layer
 * (src/app/_jobs/handlers.ts) so this module never imports feature modules.
 * A returned string is kept on the DONE row as a note.
 */
export type JobHandlers = Record<
  JobType | RetiredJobType,
  (payload: unknown) => Promise<string | void>
>;

export type RunResult = { done: number; failed: { id: string; type: string; error: string }[] };
