'use client';

import {
  FilterBar,
  FilterDateRange,
  FilterSelect,
  FilterTabs,
  FilterToggle,
  statusLabel,
} from '@/modules/core/components';
import { AGE_LABEL, LEAD_AGES, LEAD_STATUS, SOURCE_LABEL } from '../constants/statuses';

type Option = { id: string; name: string };

/** Age tabs, then search → status → course/batch → date range, then source + needs a human. */
export function LeadFilters({ courses, batches }: { courses: Option[]; batches: Option[] }) {
  return (
    <>
      <FilterTabs
        param="age"
        label="Lead age"
        options={LEAD_AGES.map((a) => ({ value: a, label: AGE_LABEL[a] }))}
      />
      <FilterBar>
        <FilterSelect
          param="status"
          label="Status"
          options={LEAD_STATUS.map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        <FilterSelect
          param="courseId"
          label="Course"
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          param="batchId"
          label="Batch"
          options={batches.map((b) => ({ value: b.id, label: b.name }))}
        />
        <FilterDateRange />
        <FilterSelect
          param="source"
          label="Source"
          options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterToggle param="needsHuman" label="Needs a human" />
      </FilterBar>
    </>
  );
}
