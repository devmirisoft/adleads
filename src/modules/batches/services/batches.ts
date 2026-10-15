import 'server-only';
import type { BatchStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { zoom } from '@/lib/zoom/client';
import { batchInputSchema, type BatchInput } from '../types';

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
  const course = await db.course.findUniqueOrThrow({ where: { id: b.courseId } });
  const fields = { ...b, startDate: toDate(b.startDate), endDate: toDate(b.endDate) };
  const { meetingId } = await zoom.createMeeting({
    topic: `${course.name} — ${b.name}`,
    hostUser: b.zoomHostUser,
    ...fields,
  });
  return db.batch.create({ data: { ...fields, zoomMeetingId: meetingId } });
}

// ponytail: editing days/times doesn't update the Zoom meeting's schedule; add zoom.updateMeeting when live.
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
  await assertNoHostClash(b, id);
  return db.batch.update({
    where: { id },
    data: {
      ...b,
      startDate: toDate(b.startDate),
      endDate: toDate(b.endDate),
      status: statusFor(current.status, current.seatsTaken, b.capacity),
    },
  });
}

/** CLOSED is manual: no new trials. Existing students keep their seats and links. */
export async function closeBatch(id: string) {
  return db.batch.update({ where: { id }, data: { status: 'CLOSED' } });
}
