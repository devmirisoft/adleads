import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/modules/core/components';
import { LoginForm } from '@/modules/auth';

export const metadata: Metadata = {
  title: 'Sign in · AdLeads',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
          <CardDescription>Use your AdLeads staff account.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* LoginForm reads ?callbackUrl, a request-time value. */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
