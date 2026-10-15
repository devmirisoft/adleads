import { CAN_ACT, requireUser } from '@/modules/auth';
import { listAllBatches, listCourses } from '@/modules/batches';
import { PageHeader } from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';
import {
  LeadExportButton,
  LeadFilterBar,
  leadFiltersSchema,
  LeadsTable,
  listLeads,
} from '@/modules/leads';
import { listStaff } from '@/modules/settings';

export default async function LeadsPage({ searchParams }: PageProps<'/leads'>) {
  const user = await requireUser();
  const canAct = CAN_ACT.includes(user.role);
  const filters = leadFiltersSchema.parse(flatParams(await searchParams));
  const [result, courses, batches, staff] = await Promise.all([
    listLeads(filters),
    listCourses(),
    listAllBatches(),
    listStaff(),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Everyone who messaged us on WhatsApp"
        actions={canAct && <LeadExportButton />}
      />
      <LeadFilterBar courses={courses} batches={batches} />
      <LeadsTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        staff={staff}
        canAct={canAct}
        currentUserId={user.id}
      />
    </>
  );
}
