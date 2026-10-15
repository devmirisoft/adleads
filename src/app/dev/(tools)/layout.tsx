import { Suspense } from 'react';
import { Skeleton } from '@/modules/core/components';
import { StaffShell } from '../../_shell/StaffShell';

// Simulators run inside the normal staff shell so the admin screens are one click away.
export default function DevToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
