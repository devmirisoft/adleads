import { Suspense } from 'react';
import { AdminShell, Skeleton } from '@/modules/core/components';
import { Showcase } from './Showcase';

export default function DevUiPage() {
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
