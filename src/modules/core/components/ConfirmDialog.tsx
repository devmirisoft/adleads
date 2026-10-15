'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Button } from './ui/button';

type Props = {
  /** Name the exact thing affected: "Cancel Rahul Sharma's enrollment in Morning Mon–Fri?" */
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  /** Stays open with a spinner until this settles; closes on success. Toast the result yourself. */
  onConfirm: () => Promise<unknown> | void;
  /** Element that opens the dialog. Omit and use `open`/`onOpenChange` to control it (e.g. from a menu item). */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional extra fields between the text and the buttons, e.g. a reason input. */
  children?: React.ReactNode;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = 'default',
  onConfirm,
  trigger,
  open: controlledOpen,
  onOpenChange,
  children,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (pending) return;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      setPending(false);
      setUncontrolledOpen(false);
      onOpenChange?.(false);
    } catch {
      setPending(false);
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={confirm}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
