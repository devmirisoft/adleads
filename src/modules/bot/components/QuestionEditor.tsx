'use client';

import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Button,
  FormActions,
  FormField,
  Input,
  KeyValueList,
  Label,
  SectionCard,
  Switch,
  Textarea,
  toast,
} from '@/modules/core/components';
import { saveQuestionAction } from '../services/actions';
import type { OptionsPreview, ScriptQuestion } from '../services/script';
import { questionUpdateSchema, type QuestionUpdate } from '../types';

const INPUT_LABEL = { TEXT: 'Free text', BUTTONS: 'Buttons', LIST: 'List' } as const;
const SOURCE_HINT = {
  STATIC: '',
  COURSES: 'Options: the active courses (edit them on the Courses tab).',
  BATCHES: 'Options: the open batches of the course they picked.',
} as const;
const CONFIRM_HINT = 'Their name, course and batch are listed above this message.';

/** One bot question: prompt, static option labels, on/off, and the list it sends (`preview`). */
export function QuestionEditor({
  question: q,
  preview,
}: {
  question: ScriptQuestion;
  preview?: OptionsPreview;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<QuestionUpdate>({
    resolver: zodResolver(questionUpdateSchema),
    defaultValues: {
      prompt: q.prompt,
      isActive: q.isActive,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
    },
  });
  const { fields } = useFieldArray({ control, name: 'options' });

  async function onSubmit(values: QuestionUpdate) {
    const res = await saveQuestionAction(q.id, values);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Step ${q.step} saved`);
    reset(values);
  }

  return (
    <SectionCard
      title={`Step ${q.step}: ${q.key}`}
      description={`${INPUT_LABEL[q.inputType]}. ${q.key === 'confirm' ? CONFIRM_HINT : SOURCE_HINT[q.optionsSource]}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          id={`q-${q.id}-prompt`}
          label="Message the bot sends"
          required
          error={errors.prompt?.message}
        >
          <Textarea
            id={`q-${q.id}-prompt`}
            rows={3}
            aria-invalid={!!errors.prompt}
            {...register('prompt')}
          />
        </FormField>
        {preview && <OptionsPreviewList preview={preview} />}
        {fields.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f, i) => (
              <FormField
                key={f.id}
                id={`q-${q.id}-opt-${i}`}
                label={`Button: ${q.options[i]?.value}`}
                required
                error={errors.options?.[i]?.label?.message}
              >
                <Input
                  id={`q-${q.id}-opt-${i}`}
                  aria-invalid={!!errors.options?.[i]?.label}
                  {...register(`options.${i}.label`)}
                />
              </FormField>
            ))}
          </div>
        )}
        <FormActions>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center gap-2 sm:mr-auto">
                <Switch
                  id={`q-${q.id}-active`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor={`q-${q.id}-active`}>Ask this question</Label>
              </div>
            )}
          />
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save changes
          </Button>
        </FormActions>
      </form>
    </SectionCard>
  );
}

const NOTHING_OPEN =
  'No course has an open batch right now, so the bot hands the lead to staff here.';

/** The list the lead gets under this question, as the bot would build it right now. */
function OptionsPreviewList({ preview }: { preview: OptionsPreview }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">What the lead sees: a “{preview.button}” list</p>
      {preview.groups.length === 0 && (
        <p className="text-xs text-muted-foreground">{NOTHING_OPEN}</p>
      )}
      {preview.groups.map((g, i) => (
        <div key={g.heading ?? i} className="flex flex-col gap-2">
          {g.heading && <p className="text-xs text-muted-foreground">{g.heading}</p>}
          <KeyValueList items={g.rows.map((r) => ({ label: r.title, value: r.description }))} />
        </div>
      ))}
    </div>
  );
}
