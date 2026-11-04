import 'server-only';
import type { BatchStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { LinkKind } from '@/modules/core/types';
import { batchInputSchema, type BatchInput, type LinkChange } from '../types';

// seats_taken is never written here — only enrollments.assignSeat & co. change it.

export class BatchError extends Error {
  name = 'BatchError';
}

type Parsed = BatchInput;
const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`); // @db.Date

const parse = (input: BatchInput) => {
  const b = batchInputSchema.parse(input);
  return { ...b, daysOfWeek: [...new Set(b.daysOfWeek)].sort((x, y) => x - y) };
};

const toData = (b: Parsed) => ({
  ...b,
  startDate: toDate(b.startDate),
  endDate: toDate(b.endDate),
  trialLink: b.trialLink || null,
  paidLink: b.paidLink || null,
});

/** Same Zoom host, overlapping dates, a shared weekday and overlapping times → can't run both. */
async function assertNoHostClash(b: Parsed, excludeId?: string) {
  const others = await db.batch.findMany({
    where: {
      zoomHostUser: b.zoomHostUser,
      status: { not: 'CLOSED' },
      startDate: { lte: toDate(b.endDate) },
      endDate: { gte: toDate(b.startDate) },
      daysOfWeek: { hasSome: b.daysOfWeek },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  const clash = others.find((o) => o.startTime < b.endTime && b.startTime < o.endTime);
  if (clash) {
    throw new BatchError(
      `${b.zoomHostUser} already hosts "${clash.name}" at an overlapping time. Pick another host or time.`,
    );
  }
}

const statusFor = (status: BatchStatus, seatsTaken: number, capacity: number): BatchStatus =>
  status === 'CLOSED' ? 'CLOSED' : seatsTaken >= capacity ? 'FULL' : 'OPEN';

export async function createBatch(input: BatchInput) {
  const b = parse(input);
  await assertNoHostClash(b);
  return db.batch.create({ data: toData(b) });
}

/** What the host clash check looks at. */
const slot = (b: {
  zoomHostUser: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate: Date;
}) =>
  JSON.stringify([b.zoomHostUser, b.daysOfWeek, b.startTime, b.endTime, b.startDate, b.endDate]);

/** Who a new link goes to. Opted-out leads never get messages, so they don't count. */
const countRecipients = (batchId: string, kind: LinkKind) =>
  db.enrollment.count({
    where: { batchId, status: kind === 'trial' ? 'TRIAL' : 'PAID', lead: { optedOutAt: null } },
  });

export async function updateBatch(id: string, input: BatchInput) {
  const b = parse(input);
  const current = await db.batch.findUniqueOrThrow({ where: { id } });
  if (b.capacity < current.seatsTaken) {
    throw new BatchError(
      `${current.seatsTaken} seats are already taken — capacity can't be lower than that.`,
    );
  }
  if (b.courseId !== current.courseId && current.seatsTaken > 0) {
    throw new BatchError("This batch has students, so its course can't change.");
  }
  const data = toData(b);
  // Only if this save moves the slot: an old overlap must not block rotating a dead link.
  if (slot(data) !== slot(current)) await assertNoHostClash(b, id);
  const batch = await db.batch.update({
    where: { id },
    data: { ...data, status: statusFor(current.status, current.seatsTaken, b.capacity) },
  });

  const changed: LinkKind[] = [];
  if (data.trialLink && data.trialLink !== current.trialLink) changed.push('trial');
  if (data.paidLink && data.paidLink !== current.paidLink) changed.push('paid');
  const counted: LinkChange[] = await Promise.all(
    changed.map(async (kind) => ({ kind, recipients: await countRecipients(id, kind) })),
  );
  return { batch, linkChanges: counted.filter((c) => c.recipients > 0) };
}

/** CLOSED is manual: no new trials. Existing students keep their seats and links. */
export async function closeBatch(id: string) {
  return db.batch.update({ where: { id }, data: { status: 'CLOSED' } });
}
