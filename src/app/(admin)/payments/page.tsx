import { CAN_ACT, requireUser } from '@/modules/auth';
import { PageHeader } from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';
import {
  listPayableEnrollments,
  listPayments,
  ManualPaymentDialog,
  PaymentFilterBar,
  paymentFiltersSchema,
  PaymentsTable,
} from '@/modules/payments';

export default async function PaymentsPage({ searchParams }: PageProps<'/payments'>) {
  const user = await requireUser();
  const canAct = CAN_ACT.includes(user.role);
  const filters = paymentFiltersSchema.parse(flatParams(await searchParams));
  const [result, payable] = await Promise.all([
    listPayments(filters),
    canAct ? listPayableEnrollments() : [],
  ]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Razorpay links and manual payments"
        actions={canAct && <ManualPaymentDialog enrollments={payable} />}
      />
      <PaymentFilterBar />
      <PaymentsTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        canAct={canAct}
      />
    </>
  );
}
