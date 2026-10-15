'use client';

import { useTransition } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, toast } from '@/modules/core/components';
import { resolveLead } from '../services/actions';

/** Clears "needs a human" / unread so the lead leaves the inbox. */
export function ResolveButton({
  leadId,
  variant = 'outline',
}: {
  leadId: string;
  variant?: 'outline' | 'default';
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolveLead(leadId);
          if (res.ok) toast.success('Marked resolved');
          else toast.error(res.error);
        })
      }
    >
      <CheckCheck className="size-4" aria-hidden />
      Mark resolved
    </Button>
  );
}
