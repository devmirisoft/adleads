import { Suspense } from 'react';
import { requireUser } from '@/modules/auth';
import { AdminShell, Skeleton } from '@/modules/core/components';
import { devOnly } from '../devOnly';
import { Showcase } from './Showcase';

export default function DevUiPage() {
  devOnly();
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <SignedIn />
    </Suspense>
  );
}

async function SignedIn() {
  await requireUser();
  return (
    <AdminShell
      user={{ name: 'Priya Verma', email: 'priya@example.com', role: 'ADMIN' }}
      unreadCount={3}
    >
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Showcase />
      </Suspense>
    </AdminShell>
  );
}
