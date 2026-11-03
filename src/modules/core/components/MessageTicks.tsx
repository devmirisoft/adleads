import { Check, CheckCheck, CircleAlert, Clock, type LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';

type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

const TICKS: Record<MessageStatus, { icon: LucideIcon; label: string; tone: string }> = {
  QUEUED: { icon: Clock, label: 'Sending', tone: 'text-muted-foreground' },
  SENT: { icon: Check, label: 'Sent', tone: 'text-muted-foreground' },
  DELIVERED: { icon: CheckCheck, label: 'Delivered', tone: 'text-muted-foreground' },
  READ: { icon: CheckCheck, label: 'Read', tone: 'text-read' },
  FAILED: { icon: CircleAlert, label: 'Not sent', tone: 'text-danger' },
};

/**
 * WhatsApp delivery state of a sent message: clock, ✓, ✓✓, blue ✓✓, red !.
 * READ differs from DELIVERED only by colour, so the label carries it too (tooltip and screen reader).
 */
export function MessageTicks({ status, className }: { status: MessageStatus; className?: string }) {
  const { icon: Icon, label, tone } = TICKS[status];
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      <Icon className={cn('size-4', tone, className)} aria-hidden />
    </span>
  );
}
