'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, FormField, Textarea, toast } from '@/modules/core/components';
import { updateNotes } from '../services/actions';

export function NotesForm({
  leadId,
  notes,
  canEdit,
}: {
  leadId: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(notes ?? '');
  const [pending, start] = useTransition();
  if (!canEdit) {
    return <p className="text-sm whitespace-pre-wrap">{notes || 'No notes yet.'}</p>;
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateNotes(leadId, value);
          if (res.ok) toast.success('Notes saved');
          else toast.error(res.error);
        });
      }}
    >
      <FormField id="notes" label="Notes" help="Only staff see these.">
        <Textarea id="notes" rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || value === (notes ?? '')}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save notes
        </Button>
      </div>
    </form>
  );
}
