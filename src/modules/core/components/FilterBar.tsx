'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryState } from '../hooks/useQueryState';
import { cn } from '../utils/cn';

/**
 * Search (URL param `q`) first, then `children` filters in a wrapping row.
 * Order children: status → course/batch → date range. Render inside <Suspense>.
 */
export function FilterBar({
  searchPlaceholder = 'Name or phone',
  children,
}: {
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  const [q, setQ] = useQueryState('q');
  const setQDebounced = useDebounce(setQ);
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex w-full items-end gap-2 sm:w-auto">
        <div className="flex flex-1 flex-col gap-1 sm:w-64 sm:flex-none">
          <Label htmlFor="filter-q" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="filter-q"
              type="search"
              className="pl-8"
              placeholder={searchPlaceholder}
              defaultValue={q}
              onChange={(e) => setQDebounced(e.target.value.trim() || null)}
            />
          </div>
        </div>
        {children && (
          // ponytail: no active-filter count on this button; add one (a `params` prop) if staff miss hidden filters
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Filters"
            aria-expanded={open}
            aria-controls="filter-panel"
            onClick={() => setOpen((o) => !o)}
          >
            <SlidersHorizontal className="size-5" />
          </Button>
        )}
      </div>
      {children && (
        <div
          id="filter-panel"
          className={cn(open ? 'flex' : 'hidden', 'w-full flex-col gap-3 md:contents')}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** From/to date pickers bound to two URL params (IST calendar dates, "yyyy-MM-dd"). Goes last in FilterBar. */
export function FilterDateRange({
  fromParam = 'from',
  toParam = 'to',
  label = 'Created',
}: {
  fromParam?: string;
  toParam?: string;
  label?: string;
}) {
  const [from, setFrom] = useQueryState(fromParam);
  const [to, setTo] = useQueryState(toParam);
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs text-muted-foreground">{label}</legend>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={`${label} from`}
          className="w-36"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value || null)}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          aria-label={`${label} to`}
          className="w-36"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value || null)}
        />
      </div>
    </fieldset>
  );
}

/** On/off filter bound to one URL param ("1" when on). */
export function FilterToggle({ param, label }: { param: string; label: string }) {
  const [value, setValue] = useQueryState(param);
  const id = `filter-${param}`;
  return (
    <div className="flex h-8 items-center gap-2">
      <Switch id={id} checked={value === '1'} onCheckedChange={(on) => setValue(on ? '1' : null)} />
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
    </div>
  );
}

type FilterSelectProps = {
  /** URL search param this filter writes to. */
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
};

const ALL = '__all';

/** A select bound to one URL param, for use inside FilterBar. */
export function FilterSelect({ param, label, options, allLabel = 'All' }: FilterSelectProps) {
  const [value, setValue] = useQueryState(param);
  const id = `filter-${param}`;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(v) => setValue(v === ALL ? null : v)}>
        <SelectTrigger id={id} className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Tabs bound to one URL param, above FilterBar: one tab per value plus "All" (no param). */
export function FilterTabs({
  param,
  label,
  options,
  allLabel = 'All',
}: {
  param: string;
  /** Accessible name for the tab list. */
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const [value, setValue] = useQueryState(param);
  return (
    <Tabs
      value={value || ALL}
      onValueChange={(v) => setValue(v === ALL ? null : v)}
      className="mb-4"
    >
      <TabsList aria-label={label}>
        <TabsTrigger value={ALL}>{allLabel}</TabsTrigger>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
