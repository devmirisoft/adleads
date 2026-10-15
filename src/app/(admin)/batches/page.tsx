import { ADMIN_ONLY, requireUser } from '@/modules/auth';
import {
  AddBatchButton,
  BatchFilterBar,
  batchFiltersSchema,
  BatchTable,
  listBatches,
  listCourses,
} from '@/modules/batches';
import { PageHeader } from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';

export default async function BatchesPage({ searchParams }: PageProps<'/batches'>) {
  const user = await requireUser();
  const canEdit = ADMIN_ONLY.includes(user.role);
  const filters = batchFiltersSchema.parse(flatParams(await searchParams));
  const [result, courses] = await Promise.all([listBatches(filters), listCourses()]);

  return (
    <>
      <PageHeader
        title="Batches"
        description="Class timings, seats and Zoom meetings"
        actions={canEdit && <AddBatchButton courses={courses} />}
      />
      <BatchFilterBar courses={courses} />
      <BatchTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        courses={courses}
        canEdit={canEdit}
      />
    </>
  );
}
