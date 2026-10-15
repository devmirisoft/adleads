import { z } from 'zod';

/** Every setting key, its type and default. The settings table may lack a row — the default applies. */
export const SETTINGS = {
  default_trial_days: { schema: z.number().int().min(1).max(30), default: 3 },
  reminder_days_before: { schema: z.number().int().min(0).max(14), default: 2 },
  payment_link_expiry_hours: { schema: z.number().int().min(1).max(720), default: 72 },
  welcome_text: {
    schema: z.string().min(1).max(500),
    default: 'Hi! Thanks for your interest in our live online classes.',
  },
  nudge_after_hours: {
    schema: z.array(z.number().int().min(1).max(23)).max(2),
    default: [3, 22] as number[],
  },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = (typeof SETTINGS)[K]['default'];
export type AllSettings = { [K in SettingKey]: SettingValue<K> };

const whole = (label: string, min: number, max: number) =>
  z
    .number(`Enter ${label}`)
    .int('Whole numbers only')
    .min(min, `At least ${min}`)
    .max(max, `At most ${max}`);

/** The General tab form (shared with its server action). */
export const settingsFormSchema = z
  .object({
    default_trial_days: whole('the trial length', 1, 30),
    reminder_days_before: whole('days', 0, 14),
    payment_link_expiry_hours: whole('hours', 1, 720),
    welcome_text: z
      .string()
      .trim()
      .min(1, 'Write a welcome message')
      .max(500, 'Keep it under 500 characters'),
    first_nudge_hours: whole('hours', 1, 23),
    second_nudge_hours: whole('hours', 1, 23),
  })
  .refine((s) => s.second_nudge_hours > s.first_nudge_hours, {
    path: ['second_nudge_hours'],
    message: 'Must be later than the first reminder',
  });
export type SettingsForm = z.infer<typeof settingsFormSchema>;

export const ROLE_LABEL = { ADMIN: 'Admin', SALES: 'Sales', VIEWER: 'Viewer' } as const;

/** Add user form (shared with its server action). */
export const newUserSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  email: z.email('Enter a valid email'),
  role: z.enum(['ADMIN', 'SALES', 'VIEWER'], 'Choose a role'),
  password: z.string().min(10, 'At least 10 characters').max(200),
});
export type NewUser = z.infer<typeof newUserSchema>;
