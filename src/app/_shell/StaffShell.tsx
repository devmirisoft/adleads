import { realtimePublicConfig } from '@/lib/realtime/client';
import { requireUser, signOutAction } from '@/modules/auth';
import { countInbox } from '@/modules/leads';
import { LiveAdminShell } from './LiveAdminShell';

/** AdminShell for the signed-in staff member, with the Inbox badge. Render inside <Suspense>. */
export async function StaffShell({ children }: { children: React.ReactNode }) {
  const [user, unreadCount] = await Promise.all([requireUser(), countInbox()]);
  return (
    <LiveAdminShell
      user={user}
      unreadCount={unreadCount}
      signOutAction={signOutAction}
      realtime={realtimePublicConfig()}
    >
      {children}
    </LiveAdminShell>
  );
}
