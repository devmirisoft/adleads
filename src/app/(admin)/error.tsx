'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button, EmptyState } from '@/modules/core/components';

/** Any admin page that fails to load. Plain words, a way forward, no stack traces. */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This page didn’t load"
      description={`Try again in a moment. If it keeps happening, tell an admin${error.digest ? ` and quote code ${error.digest}` : ''}.`}
      action={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
