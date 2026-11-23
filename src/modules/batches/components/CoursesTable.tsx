'use client';

import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BookOpen,
  Bot,
  CalendarDays,
  Clock,
  IndianRupee,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FormActions,
  FormField,
  Input,
  Label,
  Money,
  Switch,
  Textarea,
  toast,
  type DataTableColumn,
} from '@/modules/core/components';
import { deleteCourseAction, saveCourseAction } from '../services/actions';
import type { CourseListItem } from '../services/queries';
import { courseInputSchema, type CourseInput } from '../types';

function CourseFormDialog({
  open,
  onOpenChange,
  course,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course?: CourseListItem;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseInput>({
    resolver: zodResolver(courseInputSchema),
    defaultValues: course
      ? {
          name: course.name,
          description: course.description,
          feeRupees: course.feePaise / 100,
          trialDays: course.trialDays,
          sortOrder: course.sortOrder,
          isActive: course.isActive,
          links: course.links.map((url) => ({ url })),
          linkIntervalDays: course.linkIntervalDays,
        }
      : { trialDays: null, sortOrder: 0, isActive: true, links: [], linkIntervalDays: 1 },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'links' });

  async function onSubmit(values: CourseInput) {
    const res = await saveCourseAction(course?.id ?? null, values);
    if (!res.ok) return void toast.error(res.error);
    toast.success(course ? 'Course saved' : 'Course added');
    if (!course) reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-svh overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{course ? `Edit ${course.name}` : 'Add course'}</DialogTitle>
          <DialogDescription>Active courses appear in the bot’s course list.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            id="c-name"
            label="Name"
            required
            help="WhatsApp shows the first 24 characters"
            error={errors.name?.message}
          >
            <Input id="c-name" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField
            id="c-desc"
            label="Short description"
            required
            help="Up to 72 characters, shown under the name"
            error={errors.description?.message}
          >
            <Textarea
              id="c-desc"
              rows={2}
              aria-invalid={!!errors.description}
              {...register('description')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="c-fee" label="Fee (₹)" required error={errors.feeRupees?.message}>
              <Input
                id="c-fee"
                type="number"
                step="0.01"
                min={0}
                aria-invalid={!!errors.feeRupees}
                {...register('feeRupees', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              id="c-trial"
              label="Trial days"
              help="Empty = default"
              error={errors.trialDays?.message}
            >
              <Input
                id="c-trial"
                type="number"
                min={1}
                max={30}
                aria-invalid={!!errors.trialDays}
                {...register('trialDays', {
                  setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                })}
              />
            </FormField>
            <FormField
              id="c-sort"
              label="Order"
              required
              help="Lower shows first"
              error={errors.sortOrder?.message}
            >
              <Input
                id="c-sort"
                type="number"
                min={0}
                aria-invalid={!!errors.sortOrder}
                {...register('sortOrder', { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm font-medium">Links</legend>
            <p className="text-xs text-muted-foreground">
              Sent to each lead one at a time on WhatsApp: link 1 on the first day of their trial,
              then the next one every few days. Unpaid trials get a payment reminder after the last
              link.
            </p>
            <FormField
              id="c-interval"
              label="Send a link every (days)"
              required
              help="1 = daily"
              error={errors.linkIntervalDays?.message}
            >
              <Input
                id="c-interval"
                type="number"
                min={1}
                max={30}
                className="w-24"
                aria-invalid={!!errors.linkIntervalDays}
                {...register('linkIntervalDays', { valueAsNumber: true })}
              />
            </FormField>
            {fields.map((f, i) => (
              <FormField
                key={f.id}
                id={`c-link-${i}`}
                label={`Link ${i + 1}`}
                required
                error={errors.links?.[i]?.url?.message}
              >
                <div className="flex gap-2">
                  <Input
                    id={`c-link-${i}`}
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    aria-invalid={!!errors.links?.[i]?.url}
                    {...register(`links.${i}.url`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove link ${i + 1}`}
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              </FormField>
            ))}
            {errors.links?.message && (
              <p className="text-xs text-danger" role="alert">
                {errors.links.message}
              </p>
            )}
            <div>
              <Button type="button" variant="outline" onClick={() => append({ url: '' })}>
                <Plus className="size-4" aria-hidden />
                Add link
              </Button>
            </div>
          </fieldset>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="c-active" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="c-active">Active (offered by the bot)</Label>
              </div>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {course ? 'Save changes' : 'Add course'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ course }: { course: CourseListItem }) {
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const unused = course._count.batches === 0 && course._count.leads === 0;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${course.name}`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit course</DropdownMenuItem>
          {unused && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
              Delete course
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CourseFormDialog
        open={dialog === 'edit'}
        onOpenChange={(o) => setDialog(o ? 'edit' : null)}
        course={course}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => setDialog(o ? 'delete' : null)}
        tone="danger"
        title={`Delete ${course.name}?`}
        description="It has no batches or leads yet, so nothing else is affected."
        confirmLabel="Delete course"
        onConfirm={async () => {
          const res = await deleteCourseAction(course.id);
          if (res.ok) toast.success(`${course.name} deleted`);
          else toast.error(res.error);
        }}
      />
    </>
  );
}

/** "No links" · "1 link, daily" · "12 links, every 2 days". */
const linksLabel = ({ links, linkIntervalDays: d }: CourseListItem) =>
  links.length === 0
    ? 'No links'
    : `${links.length} link${links.length === 1 ? '' : 's'}, ${d === 1 ? 'daily' : `every ${d} days`}`;

const columns: DataTableColumn<CourseListItem>[] = [
  {
    id: 'name',
    header: 'Course',
    cell: ({ row: { original: c } }) => (
      <div className="flex flex-col">
        <span className="font-medium">{c.name}</span>
        <span className="text-xs text-muted-foreground">{c.description}</span>
      </div>
    ),
  },
  { id: 'fee', header: 'Fee', cell: ({ row }) => <Money paise={row.original.feePaise} /> },
  { id: 'trial', header: 'Trial days', cell: ({ row }) => row.original.trialDays ?? 'Default' },
  { id: 'batches', header: 'Batches', cell: ({ row }) => row.original._count.batches },
  { id: 'links', header: 'Links', cell: ({ row }) => linksLabel(row.original) },
  { id: 'active', header: 'In bot', cell: ({ row }) => (row.original.isActive ? 'Yes' : 'No') },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions course={row.original} />,
  },
];

/** Courses CRUD (ADMIN, Bot script page). */
export function CoursesTable({ courses }: { courses: CourseListItem[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <FormActions>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          Add course
        </Button>
      </FormActions>
      <DataTable
        columns={columns}
        data={courses}
        total={courses.length}
        page={1}
        pageSize={Math.max(courses.length, 1)}
        card={(c) => ({
          title: c.name,
          subtitle: c.description ? (
            <span className="text-muted-foreground">{c.description}</span>
          ) : undefined,
          actions: <RowActions course={c} />,
          meta: [
            { icon: IndianRupee, label: <Money paise={c.feePaise} /> },
            {
              icon: Clock,
              label: `Trial: ${c.trialDays != null ? `${c.trialDays} days` : 'default length'}`,
            },
            {
              icon: CalendarDays,
              label: `${c._count.batches} batch${c._count.batches === 1 ? '' : 'es'}`,
            },
            { icon: Link2, label: linksLabel(c) },
            { icon: Bot, label: c.isActive ? 'Offered by the bot' : 'Not offered by the bot' },
          ],
        })}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Add one so the bot has something to offer."
          />
        }
      />
      <CourseFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
