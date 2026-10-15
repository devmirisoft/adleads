'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Button } from '@/modules/core/components';

/** Downloads the leads matching the current filters. */
export function LeadExportButton() {
  const params = new URLSearchParams(useSearchParams().toString());
  params.delete('page');
  return (
    <Button variant="outline" asChild>
      <a href={`/api/admin/leads?${params}`} download>
        <Download className="size-4" aria-hidden />
        Export CSV
      </a>
    </Button>
  );
}
