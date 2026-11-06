'use client';

import { offerSeatAction } from '../services/actions';
import type { BatchOption } from '../types';
import { BatchPickerDialog } from './BatchPickerDialog';

/** Hold a seat for a waitlisted lead and ask them to book it. Replaces any offer they hold. */
export function OfferSeatDialog({
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
      action="Offer seat"
      variant="outline"
      title={`Offer ${leadName} a seat`}
      description="Holds a seat for 24 hours and sends a message with a Book my seat button."
      emptyText="No batch with a trial link has free seats right now."
      courseId={courseId}
      batches={batches.filter((b) => b.hasTrialLink)}
      run={(batchId) => offerSeatAction(leadId, batchId)}
      success={(b) => `Seat in ${b.name} offered to ${leadName}`}
    />
  );
}
