'use client';

import {
  FilterBar,
  FilterDateRange,
  FilterSelect,
  FilterTabs,
  FilterToggle,
  statusLabel,
} from '@/modules/core/components';
import {
  AGE_LABEL,
  CALLED_LABEL,
  LEAD_AGES,
  LEAD_STAGE_KEYS,
  LEAD_STAGES,
  LEAD_STATUS,
  SOURCE_LABEL,
} from '../constants/statuses';

type Option = { id: string; name: string };
/** Batch names repeat across courses (every plan has a "Morning"), so the course goes first. */
type BatchOption = Option & { course: { name: string } };

/**
 * Age tabs, then search → status/stage → course/batch → date range, then source, called and
 * needs a human.
 */
export function LeadFilters({ courses, batches }: { courses: Option[]; batches: BatchOption[] }) {
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
          param="stage"
          label="Stage"
          options={LEAD_STAGE_KEYS.map((s) => ({ value: s, label: LEAD_STAGES[s].label }))}
        />
        <FilterSelect
          param="courseId"
          label="Course"
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          param="batchId"
          label="Batch"
          options={batches.map((b) => ({ value: b.id, label: `${b.course.name} · ${b.name}` }))}
        />
        <FilterDateRange />
        <FilterSelect
          param="source"
          label="Source"
          options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          param="called"
          label="Called"
          options={Object.entries(CALLED_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterToggle param="needsHuman" label="Needs a human" />
      </FilterBar>
    </>
  );
}
