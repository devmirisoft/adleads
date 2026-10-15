'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { formatPhone } from '../utils/phone';

/** E.164 → "+91 98123 45678" with a copy button. */
export function Phone({ e164 }: { e164: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(e164);
      toast.success('Phone number copied');
    } catch {
      toast.error('Could not copy. Select the number and copy it manually.');
    }
  }

  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {formatPhone(e164)}
      <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy phone number">
        <Copy className="size-5" />
      </Button>
    </span>
  );
}
