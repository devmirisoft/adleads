import { notFound } from 'next/navigation';
import {
  DateTime,
  KeyValueList,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/modules/core/components';
import { formatPhone } from '@/modules/core/utils';
import { getPaymentByLinkId } from '@/modules/payments';
import { PayButtons } from './PayButtons';

/** Fake Razorpay checkout: what the lead sees when they open the payment link. */
export default async function DevPayPage({ params }: PageProps<'/dev/pay/[linkId]'>) {
  const { linkId } = await params;
  const payment = await getPaymentByLinkId(linkId);
  if (!payment) notFound();
  const { lead, batch } = payment.enrollment;

  return (
    <>
      <PageHeader
        title="Razorpay checkout (test)"
        description="Pay or fail sends a signed Razorpay webhook to /api/webhooks/razorpay."
      />
      <div className="max-w-lg">
        <SectionCard title={batch.course.name} description={batch.name}>
          <div className="flex flex-col gap-6">
            <KeyValueList
              items={[
                { label: 'Lead', value: lead.name ?? lead.profileName ?? '—' },
                { label: 'Phone', value: formatPhone(lead.phoneE164) },
                { label: 'Amount', value: <Money paise={payment.amountPaise} /> },
                { label: 'Status', value: <StatusBadge status={payment.status} /> },
                {
                  label: 'Link expires',
                  value: payment.linkExpiresAt ? <DateTime value={payment.linkExpiresAt} /> : '—',
                },
              ]}
            />
            <PayButtons linkId={linkId} disabled={payment.status !== 'CREATED'} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
