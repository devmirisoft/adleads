import { PieChart as PieChartIcon } from 'lucide-react';
import { requireUser } from '@/modules/auth';
import {
  EmptyState,
  FilterDateRange,
  Money,
  PageHeader,
  PieChart,
  SectionCard,
  StatTile,
} from '@/modules/core/components';
import { flatParams } from '@/modules/core/utils';
import { BatchTable, listAllBatches } from '@/modules/batches';
import {
  CourseBreakdownTable,
  FunnelCard,
  getBatchPreference,
  getCourseBreakdown,
  getFunnel,
  getLeadsByAd,
  getStats,
  LeadsByAdTable,
  resolveRange,
} from '@/modules/dashboard';
import { LEAD_STAGE_KEYS, LEAD_STAGES, LEAD_STATUS } from '@/modules/leads';

const stageColumns = LEAD_STAGE_KEYS.map((key) => ({ key, ...LEAD_STAGES[key] }));

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  await requireUser(); // also makes this per request: the stats are "as of now"
  const sp = flatParams(await searchParams);
  const range = await resolveRange(sp.from, sp.to);
  const [stats, funnel, ads, batches, batchPreference, courses] = await Promise.all([
    getStats(),
    getFunnel(range),
    getLeadsByAd(range),
    listAllBatches(),
    getBatchPreference(range),
    getCourseBreakdown(range),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" description="Leads, trials and revenue at a glance" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Leads today" value={stats.leadsToday} />
        <StatTile label="Leads, last 7 days" value={stats.leads7d} />
        <StatTile label="Active trials" value={stats.activeTrials} />
        <StatTile
          label="Trial → paid"
          value={stats.trialToPaidPct === null ? '—' : `${stats.trialToPaidPct}%`}
          hint="Trials started in the last 30 days that have ended"
        />
        <StatTile
          className="col-span-2 lg:col-span-1"
          label="Revenue this month"
          value={<Money paise={stats.revenueThisMonthPaise} />}
        />
      </div>
      <div className="mb-4">
        <FilterDateRange label="Leads created" />
      </div>
      {/* Full width: a column per stage doesn't fit in the 2/3 column. */}
      <div className="mb-6">
        <SectionCard
          title="Courses"
          description="Leads created in this range by the course they chose and where they are now, and payments received in this range"
        >
          <CourseBreakdownTable rows={courses} stages={stageColumns} />
        </SectionCard>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SectionCard
            title="Leads by ad"
            description="Click-to-WhatsApp ads, leads created in this range"
          >
            <LeadsByAdTable rows={ads} />
          </SectionCard>
          <SectionCard title="Batches" description="Seats left right now">
            <BatchTable
              data={batches}
              total={batches.length}
              page={1}
              pageSize={Math.max(batches.length, 1)}
              courses={[]}
              canEdit={false}
            />
          </SectionCard>
        </div>
        <div className="flex flex-col gap-6">
          <FunnelCard counts={funnel} order={LEAD_STATUS} />
          <SectionCard
            title="Batch preference"
            description="Batches joined by leads created in this range (cancelled enrollments left out)"
          >
            <PieChart
              data={batchPreference}
              otherLabel="Other batches"
              emptyState={
                <EmptyState
                  icon={PieChartIcon}
                  title="No enrollments yet"
                  description="Leads created in this range haven't joined a batch."
                />
              }
            />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
