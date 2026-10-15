'use server';
import 'server-only';
import { AuthError, CredentialsSignin } from 'next-auth';
import { signIn, signOut } from '@/lib/auth';
import type { ApiResult } from '@/modules/core/types';
import { loginSchema, type LoginInput } from '../types';

/** Only same-site paths: "/leads?x=1" ok; "//evil.com", "/\evil.com", "https://…" are not. */
const safeCallback = (url?: string) => (url && /^\/(?![/\\])/.test(url) ? url : '/dashboard');

export async function login(input: LoginInput, callbackUrl?: string): Promise<ApiResult<null>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter your email and password.' };
  try {
    // Redirects (throws NEXT_REDIRECT) on success.
    await signIn('credentials', { ...parsed.data, redirectTo: safeCallback(callbackUrl) });
  } catch (e) {
    // CredentialsSignin = authorize() returned null; any other AuthError = it threw (e.g. DB down).
    if (e instanceof CredentialsSignin) {
      return {
        ok: false,
        error:
          'Wrong email or password, or your account is inactive. Ask an admin if you are locked out.',
      };
    }
    if (e instanceof AuthError) {
      console.error('Sign-in failed', e);
      return { ok: false, error: 'Sign-in is not working right now. Try again in a minute.' };
    }
    throw e;
  }
  return { ok: true, data: null };
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}
