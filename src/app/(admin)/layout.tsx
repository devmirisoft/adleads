import { Suspense } from 'react';
import { Skeleton } from '@/modules/core/components';
import { StaffShell } from '../_shell/StaffShell';

// Every admin page needs the session, so the whole segment streams behind one boundary.
export default function AdminLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
