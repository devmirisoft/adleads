import type { NextRequest } from 'next/server';
import { CAN_ACT, requireRole } from '@/modules/auth';
import { exportLeadsCsv, leadFiltersSchema } from '@/modules/leads';

/** CSV export of the leads list with the same filters as the page (SALES+). */
export async function GET(req: NextRequest) {
  await requireRole(...CAN_ACT);
  const filters = leadFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const csv = await exportLeadsCsv(filters);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="leads-${date}.csv"`,
    },
  });
}
