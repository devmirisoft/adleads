'use client';

import { useState, type ComponentProps } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useRealtimeChannel } from '@/lib/realtime/browser';
import { INBOX_CHANNEL, type RealtimePublicConfig } from '@/lib/realtime/types';
import { AdminShell } from '@/modules/core/components';
import { useDebounce } from '@/modules/core/hooks';

type Props = ComponentProps<typeof AdminShell> & { realtime: RealtimePublicConfig | null };

/** AdminShell whose Inbox badge, and the inbox list when it's on screen, follow `inbox.changed`. */
export function LiveAdminShell({ realtime, unreadCount = 0, ...shell }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Good until the server sends a newer count (navigation, or a page refresh after an action).
  const [live, setLive] = useState({ from: unreadCount, count: unreadCount });

  const refetch = useDebounce(async () => {
    if (pathname === '/inbox') return router.refresh(); // re-renders the list and this count
    try {
      const res = await fetch('/api/admin/inbox/count', { cache: 'no-store' });
      if (res.ok) {
        const { count } = (await res.json()) as { count: number };
        setLive({ from: unreadCount, count });
      }
    } catch {
      // Only a badge: the next event or navigation corrects it.
    }
  }, 1000);
  useRealtimeChannel(realtime, INBOX_CHANNEL, () => void refetch());

  return (
    <AdminShell {...shell} unreadCount={live.from === unreadCount ? live.count : unreadCount} />
  );
}
