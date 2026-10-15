import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { Paginated } from '@/modules/core/types';
import type { PaymentFilters } from '../types';

/** Payment behind a Razorpay link id, with who and what it's for (dev checkout page). */
export function getPaymentByLinkId(razorpayLinkId: string) {
  return db.payment.findFirst({
    where: { razorpayLinkId },
    include: {
      enrollment: {
        include: {
          lead: { select: { id: true, name: true, profileName: true, phoneE164: true } },
          batch: { select: { name: true, course: { select: { name: true } } } },
        },
      },
    },
  });
}

const listInclude = {
  enrollment: {
    select: {
      id: true,
      lead: { select: { id: true, name: true, profileName: true, phoneE164: true } },
      batch: { select: { name: true } },
    },
  },
  recordedBy: { select: { name: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentListItem = Prisma.PaymentGetPayload<{ include: typeof listInclude }>;

export async function listPayments(f: PaymentFilters): Promise<Paginated<PaymentListItem>> {
  const where: Prisma.PaymentWhereInput = {
    ...(f.q && {
      OR: [
        { razorpayPaymentId: { contains: f.q } },
        { razorpayLinkId: { contains: f.q } },
        {
          enrollment: {
            lead: {
              OR: [
                { name: { contains: f.q, mode: 'insensitive' } },
                { profileName: { contains: f.q, mode: 'insensitive' } },
                { phoneE164: { contains: f.q.replace(/[^\d+]/g, '') || f.q } },
              ],
            },
          },
        },
      ],
    }),
    ...(f.status && { status: f.status }),
    ...(f.method && { method: f.method }),
  };
  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    db.payment.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

/** Trial / expired enrollments a manual payment can be recorded against. */
export async function listPayableEnrollments() {
  const rows = await db.enrollment.findMany({
    where: { status: { in: ['TRIAL', 'EXPIRED'] } },
    include: {
      lead: { select: { name: true, profileName: true } },
      batch: { select: { name: true, course: { select: { feePaise: true } } } },
    },
    orderBy: { trialEnd: 'asc' },
    take: 500,
  });
  return rows.map((e) => ({
    id: e.id,
    label: `${e.lead.name ?? e.lead.profileName ?? 'Unnamed lead'} · ${e.batch.name}`,
    feePaise: e.batch.course.feePaise,
  }));
}
export type PayableEnrollment = Awaited<ReturnType<typeof listPayableEnrollments>>[number];
