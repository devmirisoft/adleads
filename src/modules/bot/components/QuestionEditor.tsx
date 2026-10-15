'use client';

import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Button,
  FormField,
  Input,
  Label,
  SectionCard,
  Switch,
  Textarea,
  toast,
} from '@/modules/core/components';
import { saveQuestionAction } from '../services/actions';
import type { ScriptQuestion } from '../services/script';
import { questionUpdateSchema, type QuestionUpdate } from '../types';

const INPUT_LABEL = { TEXT: 'Free text', BUTTONS: 'Buttons', LIST: 'List' } as const;
const SOURCE_HINT = {
  STATIC: '',
  COURSES: 'Options: the active courses (edit them on the Courses tab).',
  BATCHES: 'Options: that course’s batches with free seats.',
} as const;

/** One bot question: prompt, static option labels, on/off. */
export function QuestionEditor({ question: q }: { question: ScriptQuestion }) {
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
      description={`${INPUT_LABEL[q.inputType]}. ${SOURCE_HINT[q.optionsSource]}`}
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
        <div className="flex items-center justify-between gap-4">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center gap-2">
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
        </div>
      </form>
    </SectionCard>
  );
}
