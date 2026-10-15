import { CAN_ACT, requireUser } from '@/modules/auth';
import { listAllBatches } from '@/modules/batches';
import { PageHeader } from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';
import {
  EnrollmentFilterBar,
  enrollmentFiltersSchema,
  EnrollmentTable,
  listEnrollments,
  listOpenBatches,
  todayIst,
} from '@/modules/enrollments';
import { requestPaymentAction } from '@/modules/payments';

export default async function EnrollmentsPage({ searchParams }: PageProps<'/enrollments'>) {
  const user = await requireUser();
  const filters = enrollmentFiltersSchema.parse(flatParams(await searchParams));
  const [result, allBatches, openBatches, today] = await Promise.all([
    listEnrollments(filters),
    listAllBatches(),
    listOpenBatches(),
    todayIst(),
  ]);

  return (
    <>
      <PageHeader title="Enrollments" description="Trials and paid students, by batch" />
      <EnrollmentFilterBar batches={allBatches} />
      <EnrollmentTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        today={today}
        batches={openBatches}
        canAct={CAN_ACT.includes(user.role)}
        requestPayment={requestPaymentAction}
      />
    </>
  );
}
