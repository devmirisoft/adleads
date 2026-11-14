'use client';

import { offerSeatAction } from '../services/actions';
import type { BatchOption } from '../types';
import { BatchPickerDialog } from './BatchPickerDialog';

/** Offer a waitlisted lead a batch and ask them to book it. Replaces any offer they hold. */
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
      description="Sends a message with a Book my seat button. The offer lasts 24 hours."
      emptyText="No open batch has a trial link right now."
      courseId={courseId}
      batches={batches.filter((b) => b.hasTrialLink)}
      run={(batchId) => offerSeatAction(leadId, batchId)}
      success={(b) => `Seat in ${b.name} offered to ${leadName}`}
    />
  );
}
