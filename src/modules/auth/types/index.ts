import { z } from 'zod';
import type { Role } from '@/modules/core/types';

export type SessionUser = { id: string; name: string; email: string; role: Role };

/** Shared by LoginForm and the login server action. */
export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;
