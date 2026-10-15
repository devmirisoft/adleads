'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button, toast } from '@/modules/core/components';
import { simulateRazorpay } from './actions';

export function PayButtons({ linkId, disabled }: { linkId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (outcome: 'paid' | 'failed') =>
    start(async () => {
      const res = await simulateRazorpay(linkId, outcome);
      if (res.ok) toast.success(res.data);
      else toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" disabled={disabled || pending} onClick={() => run('failed')}>
        Fail payment
      </Button>
      <Button disabled={disabled || pending} onClick={() => run('paid')}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Pay now
      </Button>
    </div>
  );
}
