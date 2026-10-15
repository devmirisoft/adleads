'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Download, Loader2, MoreHorizontal, Plus, Users } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Calendar,
  Checkbox,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DateTime,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FilterBar,
  FilterDateRange,
  FilterSelect,
  FilterToggle,
  FormField,
  Input,
  KeyValueList,
  Label,
  Money,
  PageHeader,
  Phone,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  StatTile,
  StatusBadge,
  STATUSES,
  statusLabel,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type Status,
} from '@/modules/core/components';
import { formatDateTime } from '@/modules/core/utils';

const TOKENS = [
  ['background', 'bg-background'],
  ['foreground', 'bg-foreground'],
  ['card', 'bg-card'],
  ['primary', 'bg-primary'],
  ['primary-foreground', 'bg-primary-foreground'],
  ['muted', 'bg-muted'],
  ['muted-foreground', 'bg-muted-foreground'],
  ['accent', 'bg-accent'],
  ['border', 'bg-border'],
  ['input', 'bg-input'],
  ['ring', 'bg-ring'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
] as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HOUR = 3600_000;

export function Showcase() {
  return (
    <>
      <PageHeader
        title="UI kit"
        description="Every token and core component. Dev only."
        actions={<Button onClick={() => toast.success('Toast works')}>Show toast</Button>}
      />
      <Tabs defaultValue="components">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="list">Sample list page</TabsTrigger>
          <TabsTrigger value="form">Sample form page</TabsTrigger>
        </TabsList>
        <TabsContent value="components" className="mt-6 flex flex-col gap-6">
          <Components />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
          <SampleListPage />
        </TabsContent>
        <TabsContent value="form" className="mt-6">
          <SampleFormPage />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Components() {
  const [date, setDate] = useState<Date | undefined>();
  const [now] = useState(() => Date.now());

  return (
    <>
      <SectionCard title="Tokens" description="Defined in globals.css only.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {TOKENS.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-12 rounded-lg border border-border ${cls}`} />
              <span className="text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="StatusBadge" description="Every status value.">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Leads today" value={24} hint="+6 vs yesterday" />
        <StatTile label="Active trials" value={58} />
        <StatTile label="Revenue this month" value={<Money paise={14_99_500_00} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Money, DateTime, Phone">
          <KeyValueList
            items={[
              { label: 'Money', value: <Money paise={299900} /> },
              { label: 'DateTime', value: <DateTime value="2026-10-14T11:00:00Z" /> },
              {
                label: 'DateTime dateOnly',
                value: <DateTime value="2026-10-14T00:00:00Z" dateOnly />,
              },
              {
                label: 'Relative',
                value: <DateTime value={new Date(now - 2 * HOUR)} relative />,
              },
              { label: 'Phone', value: <Phone e164="+919812345678" /> },
            ]}
          />
        </SectionCard>
        <SectionCard
          title="SectionCard"
          description="Card with title, description and actions."
          actions={<Button variant="outline">Edit</Button>}
        >
          <KeyValueList
            items={[
              { label: 'Batch', value: 'Morning Mon–Fri' },
              { label: 'Status', value: <StatusBadge status="TRIAL_ACTIVE" /> },
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="EmptyState">
          <EmptyState
            icon={Users}
            title="No leads yet"
            description="Leads appear here when someone messages from an ad."
            action={<Button variant="outline">Open WhatsApp simulator</Button>}
          />
        </SectionCard>
        <SectionCard title="ConfirmDialog and toasts">
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={<Button variant="outline">Close batch</Button>}
              title="Close Morning Mon–Fri?"
              description="No new leads can be assigned to this batch."
              confirmLabel="Close batch"
              onConfirm={async () => {
                await wait(800);
                toast.success('Batch closed');
              }}
            />
            <ConfirmDialog
              trigger={<Button variant="destructive">Cancel enrollment</Button>}
              tone="danger"
              title="Cancel Rahul Sharma's enrollment in Morning Mon–Fri?"
              description="Their Zoom link will stop working."
              confirmLabel="Cancel enrollment"
              onConfirm={async () => {
                await wait(800);
                toast.success('Enrollment cancelled');
              }}
            />
            <Button
              variant="outline"
              onClick={() =>
                toast.error('Payment link could not be created. Try again in a minute.')
              }
            >
              Error toast
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Primitives"
        description="shadcn/ui, re-exported from @/modules/core/components."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving
            </Button>
            <Button variant="outline" size="icon" aria-label="Add">
              <Plus className="size-5" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField id="demo-input" label="Input" required help="Helper text">
              <Input id="demo-input" placeholder="Rahul Sharma" />
            </FormField>
            <FormField id="demo-error" label="Input with error" error="Enter at least 2 characters">
              <Input id="demo-error" aria-invalid defaultValue="R" />
            </FormField>
            <FormField id="demo-select" label="Select">
              <Select>
                <SelectTrigger id="demo-select" className="w-full">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yoga">Yoga basics</SelectItem>
                  <SelectItem value="spoken">Spoken English</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="demo-textarea" label="Textarea">
              <Textarea id="demo-textarea" placeholder="Notes" />
            </FormField>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="demo-checkbox" />
                <Label htmlFor="demo-checkbox">Checkbox</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="demo-switch" />
                <Label htmlFor="demo-switch">Switch</Label>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Date (Popover + Calendar)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarDays className="size-4" aria-hidden />
                    {date ? formatDateTime(date).split(',')[0] : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover for tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Tooltip text</TooltipContent>
            </Tooltip>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog title</DialogTitle>
                  <DialogDescription>Use for forms that don&apos;t need a page.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button>Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sheet title</SheetTitle>
                  <SheetDescription>Slides in from the side.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
            <Avatar>
              <AvatarFallback>RS</AvatarFallback>
            </Avatar>
            <Badge>Badge</Badge>
            <Badge variant="outline">Outline badge</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </SectionCard>
    </>
  );
}

// ---------- Sample list page (AGENTS.md list recipe) ----------

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  status: Status;
  feePaise: number;
  createdAt: string;
};

const LEAD_STATUSES: Status[] = [
  'NEW',
  'ASKING',
  'TRIAL_ACTIVE',
  'PAYMENT_PENDING',
  'ENROLLED',
  'EXPIRED',
];
const NAMES = [
  'Rahul Sharma',
  'Ananya Iyer',
  'Vikram Singh',
  'Meera Nair',
  'Arjun Patel',
  'Sneha Reddy',
  'Karan Mehta',
  'Pooja Das',
  'Rohit Gupta',
  'Divya Menon',
  'Aman Khan',
  'Isha Joshi',
];
const SAMPLE_ROWS: LeadRow[] = NAMES.map((name, i) => ({
  id: String(i + 1),
  name,
  phone: `+9198${String(12345670 + i * 1111).padStart(8, '0')}`,
  status: LEAD_STATUSES[i % LEAD_STATUSES.length],
  feePaise: 299900,
  createdAt: new Date(Date.UTC(2026, 9, 14 - i, 5 + i, 30)).toISOString(),
}));
const PAGE_SIZE = 5;

const columns: DataTableColumn<LeadRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => <Phone e164={row.original.phone} /> },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'feePaise',
    header: 'Fee',
    cell: ({ row }) => <Money paise={row.original.feePaise} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => <DateTime value={row.original.createdAt} />,
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
  },
];

function RowActions({ row }: { row: LeadRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => toast.success(`Opened ${row.name}`)}>
            Open
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Cancel enrollment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title={`Cancel ${row.name}'s enrollment in Morning Mon–Fri?`}
        description="Their Zoom link will stop working."
        confirmLabel="Cancel enrollment"
        onConfirm={async () => {
          await wait(800);
          toast.success(`${row.name}'s enrollment cancelled`);
        }}
      />
    </>
  );
}

function SampleListPage() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const q = (params.get('q') ?? '').toLowerCase();
  const status = params.get('status');
  const page = Number(params.get('page') ?? 1) || 1;
  const filtered = SAMPLE_ROWS.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || r.phone.includes(q)) &&
      (!status || r.status === status),
  );

  return (
    <>
      <PageHeader
        title="Leads"
        description="Everyone who messaged from an ad"
        actions={
          <>
            <Button variant="outline" onClick={() => setLoading((l) => !l)}>
              {loading ? 'Show rows' : 'Show loading'}
            </Button>
            <Button>
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
          </>
        }
      />
      <FilterBar>
        <FilterSelect
          param="status"
          label="Status"
          options={LEAD_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        <FilterDateRange />
        <FilterToggle param="needsHuman" label="Needs a human" />
      </FilterBar>
      {selected.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">{selected.length} selected</p>
      )}
      <DataTable
        columns={columns}
        data={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
        total={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={loading}
        selection={{ getId: (r) => r.id, selectedIds: selected, onChange: setSelected }}
        onRowHref={(r) => `/dev/ui?lead=${r.id}`}
        emptyState={
          <EmptyState
            icon={Users}
            title="No leads match these filters"
            description="Clear the search or pick another status."
          />
        }
      />
    </>
  );
}

// ---------- Sample form page (AGENTS.md detail/form recipe) ----------

const batchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters')
    .max(60, 'Keep it under 60 characters'),
  courseId: z.string().min(1, 'Choose a course'),
  capacity: z.number('Enter a number').int('Whole numbers only').min(1, 'At least 1 seat'),
  notes: z.string().max(500),
  isActive: z.boolean(),
});

function SampleFormPage() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(batchSchema),
    defaultValues: { name: '', courseId: '', capacity: 20, notes: '', isActive: true },
  });

  async function onSubmit() {
    await wait(800);
    toast.success('Batch saved');
  }

  return (
    <>
      <PageHeader title="Add batch" description="Sample form page" backHref="/dev/ui" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Batch details">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <FormField id="name" label="Name" required error={errors.name?.message}>
                <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="courseId" label="Course" required error={errors.courseId?.message}>
                  <Controller
                    control={control}
                    name="courseId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="courseId"
                          className="w-full"
                          aria-invalid={!!errors.courseId}
                        >
                          <SelectValue placeholder="Choose a course" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yoga">Yoga basics</SelectItem>
                          <SelectItem value="spoken">Spoken English</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField
                  id="capacity"
                  label="Seats"
                  required
                  help="Maximum students in this batch"
                  error={errors.capacity?.message}
                >
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    aria-invalid={!!errors.capacity}
                    {...register('capacity', { valueAsNumber: true })}
                  />
                </FormField>
              </div>
              <FormField id="notes" label="Notes" error={errors.notes?.message}>
                <Textarea id="notes" {...register('notes')} />
              </FormField>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="isActive">Open for new leads</Label>
                  </div>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Save changes
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>
        <SectionCard title="Summary">
          <KeyValueList
            items={[
              { label: 'Fee', value: <Money paise={299900} /> },
              { label: 'Status', value: <StatusBadge status="OPEN" /> },
              { label: 'Created', value: <DateTime value="2026-10-01T04:30:00Z" /> },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
