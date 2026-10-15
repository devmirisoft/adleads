'use client';

import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button, FormField, Input, toast } from '@/modules/core/components';
import { login } from '../services/actions';
import { loginSchema, type LoginInput } from '../types';

export function LoginForm() {
  const callbackUrl = useSearchParams().get('callbackUrl') ?? undefined;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    // On success the action redirects, so a result only comes back on failure.
    const result = await login(values, callbackUrl);
    if (!result.ok) toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormField id="email" label="Email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </FormField>
      <FormField id="password" label="Password" required error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="self-end">
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}
