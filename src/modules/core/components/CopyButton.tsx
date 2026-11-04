'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';

type Props = {
  value: string;
  /** What's being copied, in lowercase: "phone number", "trial link". */
  label: string;
};

/** Icon button that copies `value` and toasts the result. */
export function CopyButton({ value, label }: Props) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label[0].toUpperCase()}${label.slice(1)} copied`);
    } catch {
      toast.error(`Could not copy the ${label}. Select it and copy it manually.`);
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={`Copy ${label}`}>
      <Copy className="size-5" />
    </Button>
  );
}
