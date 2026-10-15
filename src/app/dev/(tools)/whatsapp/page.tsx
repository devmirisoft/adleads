import { Suspense } from 'react';
import { PageHeader, Skeleton } from '@/modules/core/components';
import { leadFiltersSchema, listLeads } from '@/modules/leads';
import { WhatsAppSimulator } from '@/modules/messaging';

export default function WhatsAppSimulatorPage() {
  return (
    <>
      <PageHeader
        title="WhatsApp simulator"
        description="Chat as a lead. Each message goes through the real webhook pipeline and bot."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Simulator />
      </Suspense>
    </>
  );
}

async function Simulator() {
  const { items } = await listLeads(leadFiltersSchema.parse({ pageSize: 10 }));
  const recent = items.map((l) => ({
    phone: l.phoneE164,
    name: l.name ?? l.profileName ?? 'WhatsApp user',
  }));
  return <WhatsAppSimulator recent={recent} />;
}
