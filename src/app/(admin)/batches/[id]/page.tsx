import { notFound } from 'next/navigation';
import { ADMIN_ONLY, CAN_ACT, requireUser } from '@/modules/auth';
import { BatchActions, batchSchedule, getBatch, listCourses, SeatMeter } from '@/modules/batches';
import {
  DateTime,
  KeyValueList,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';
import {
  enrollmentFiltersSchema,
  EnrollmentTable,
  listEnrollments,
  listOpenBatches,
  todayIst,
} from '@/modules/enrollments';
import { requestPaymentAction } from '@/modules/payments';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function BatchPage({ params, searchParams }: PageProps<'/batches/[id]'>) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const filters = enrollmentFiltersSchema.parse({ ...flatParams(await searchParams), batchId: id });
  const [batch, students, courses, openBatches, today] = await Promise.all([
    getBatch(id),
    listEnrollments(filters),
    listCourses(),
    listOpenBatches(),
    todayIst(),
  ]);
  if (!batch) notFound();

  return (
    <>
      <PageHeader
        title={batch.name}
        description={batch.course.name}
        backHref="/batches"
        actions={ADMIN_ONLY.includes(user.role) && <BatchActions batch={batch} courses={courses} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Students"
            description="Everyone with a trial or paid seat, and past ones"
          >
            <EnrollmentTable
              data={students.items}
              total={students.total}
              page={students.page}
              pageSize={students.pageSize}
              today={today}
              batches={openBatches}
              canAct={CAN_ACT.includes(user.role)}
              requestPayment={requestPaymentAction}
              emptyHint="Nobody has booked this batch yet."
            />
          </SectionCard>
        </div>
        <SectionCard title="Details">
          <KeyValueList
            items={[
              { label: 'Status', value: <StatusBadge status={batch.status} /> },
              { label: 'Schedule', value: `${batchSchedule(batch)} IST` },
              {
                label: 'Runs',
                value: (
                  <span>
                    <DateTime value={batch.startDate} dateOnly /> –{' '}
                    <DateTime value={batch.endDate} dateOnly />
                  </span>
                ),
              },
              {
                label: 'Seats',
                value: <SeatMeter taken={batch.seatsTaken} capacity={batch.capacity} />,
              },
              {
                label: 'Zoom meeting',
                value: batch.zoomMeetingId ? String(batch.zoomMeetingId) : '—',
              },
              { label: 'Zoom host', value: batch.zoomHostUser ?? '—' },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
