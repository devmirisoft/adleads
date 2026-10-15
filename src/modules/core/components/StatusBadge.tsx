import { Badge } from './ui/badge';
import { cn } from '../utils/cn';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

/**
 * Every lead, enrollment, payment, batch and message status. Names shared between enums
 * (PAID, EXPIRED, CANCELLED, FAILED) mean the same thing everywhere, so one flat map.
 * New status → add it here only.
 */
const STATUS = {
  // Lead
  NEW: { label: 'New', tone: 'neutral' },
  ASKING: { label: 'Asking', tone: 'info' },
  QUALIFIED: { label: 'Qualified', tone: 'info' },
  WAITLISTED: { label: 'Waitlisted', tone: 'warning' },
  TRIAL_ACTIVE: { label: 'Trial active', tone: 'info' },
  PAYMENT_PENDING: { label: 'Payment pending', tone: 'warning' },
  ENROLLED: { label: 'Enrolled', tone: 'success' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
  DROPPED: { label: 'Dropped', tone: 'neutral' },
  OPTED_OUT: { label: 'Opted out', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  // Enrollment
  TRIAL: { label: 'Trial', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  // Payment
  CREATED: { label: 'Link created', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
  // Batch
  OPEN: { label: 'Open', tone: 'success' },
  FULL: { label: 'Full', tone: 'warning' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  // Message
  QUEUED: { label: 'Queued', tone: 'neutral' },
  SENT: { label: 'Sent', tone: 'info' },
  DELIVERED: { label: 'Delivered', tone: 'info' },
  READ: { label: 'Read', tone: 'success' },
  // Lead flags (inbox / lists)
  NEEDS_HUMAN: { label: 'Needs a human', tone: 'warning' },
  UNREAD: { label: 'Unread', tone: 'info' },
  // Staff accounts
  ACTIVE: { label: 'Active', tone: 'success' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export type Status = keyof typeof STATUS;
export const STATUSES = Object.keys(STATUS) as Status[];

export const statusLabel = (status: Status) => STATUS[status].label;

export function StatusBadge({ status }: { status: Status }) {
  const { label, tone } = STATUS[status];
  return <Badge className={cn('rounded-full', TONE_CLASS[tone])}>{label}</Badge>;
}
