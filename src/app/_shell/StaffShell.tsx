import { AdminShell } from '@/modules/core/components';
import { requireUser, signOutAction } from '@/modules/auth';
import { countInbox } from '@/modules/leads';

/** AdminShell for the signed-in staff member, with the Inbox badge. Render inside <Suspense>. */
export async function StaffShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // first: it holds queries back until the request stage
  const unreadCount = await countInbox();
  return (
    <AdminShell user={user} unreadCount={unreadCount} signOutAction={signOutAction}>
      {children}
    </AdminShell>
  );
}
