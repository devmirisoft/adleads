'use client';

import { assignBatchAction } from '../services/actions';
import type { BatchOption } from '../types';
import { BatchPickerDialog } from './BatchPickerDialog';

/** Book a trial seat for a lead by hand (they didn't finish the bot, or were waitlisted). */
export function AssignBatchDialog({
  leadId,
  leadName,
  courseId,
  batches,
}: {
  leadId: string;
  leadName: string;
  /** Lead's chosen course: its batches are listed first. */
  courseId: string | null;
  batches: BatchOption[];
}) {
  return (
    <BatchPickerDialog
      action="Assign batch"
      title={`Assign ${leadName} to a batch`}
      description="Starts their free trial and sends the batch's trial link."
      emptyText="No batch has free seats right now."
      courseId={courseId}
      batches={batches}
      run={(batchId) => assignBatchAction(leadId, batchId)}
      success={(b) => `${leadName} booked into ${b.name}`}
    />
  );
}
