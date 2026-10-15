import { CAN_ACT, requireUser } from '@/modules/auth';
import { PageHeader } from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';
import { InboxTable, listInbox } from '@/modules/leads';

const PAGE_SIZE = 25;

export default async function InboxPage({ searchParams }: PageProps<'/inbox'>) {
  const user = await requireUser();
  const sp = flatParams(await searchParams);
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listInbox({
    assignedToId: sp.view === 'mine' ? user.id : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Leads waiting for a person: flagged by the bot, or they wrote last"
      />
      <InboxTable
        data={result.items}
        total={result.total}
        page={page}
        pageSize={PAGE_SIZE}
        canAct={CAN_ACT.includes(user.role)}
      />
    </>
  );
}
