'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button, FormField, Input, SectionCard, Textarea, toast } from '@/modules/core/components';
import {
  settingsFormSchema,
  type AllSettings,
  type SettingsForm as Values,
} from '../constants/keys';
import { saveSettingsAction } from '../services/actions';

/** General tab: typed inputs for every settings key. */
export function SettingsForm({ settings }: { settings: AllSettings }) {
  const [first = 3, second = 22] = settings.nudge_after_hours;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      default_trial_days: settings.default_trial_days,
      reminder_days_before: settings.reminder_days_before,
      payment_link_expiry_hours: settings.payment_link_expiry_hours,
      welcome_text: settings.welcome_text,
      first_nudge_hours: first,
      second_nudge_hours: second,
    },
  });
  const num = { valueAsNumber: true } as const;

  async function onSubmit(values: Values) {
    const res = await saveSettingsAction(values);
    if (!res.ok) return void toast.error(res.error);
    toast.success('Settings saved');
    reset(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <SectionCard title="Trials and payments">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="s-trial"
            label="Default trial length (days)"
            required
            help="Courses can override this"
            error={errors.default_trial_days?.message}
          >
            <Input
              id="s-trial"
              type="number"
              min={1}
              max={30}
              aria-invalid={!!errors.default_trial_days}
              {...register('default_trial_days', num)}
            />
          </FormField>
          <FormField
            id="s-remind"
            label="Send payment link (days before trial ends)"
            required
            error={errors.reminder_days_before?.message}
          >
            <Input
              id="s-remind"
              type="number"
              min={0}
              max={14}
              aria-invalid={!!errors.reminder_days_before}
              {...register('reminder_days_before', num)}
            />
          </FormField>
          <FormField
            id="s-expiry"
            label="Payment link valid for (hours)"
            required
            error={errors.payment_link_expiry_hours?.message}
          >
            <Input
              id="s-expiry"
              type="number"
              min={1}
              max={720}
              aria-invalid={!!errors.payment_link_expiry_hours}
              {...register('payment_link_expiry_hours', num)}
            />
          </FormField>
        </div>
      </SectionCard>
      <SectionCard title="Bot">
        <div className="flex flex-col gap-4">
          <FormField
            id="s-welcome"
            label="Welcome message"
            required
            help="Sent before the first question"
            error={errors.welcome_text?.message}
          >
            <Textarea
              id="s-welcome"
              rows={3}
              aria-invalid={!!errors.welcome_text}
              {...register('welcome_text')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="s-nudge1"
              label="First reminder (hours of silence)"
              required
              help="Leads stuck mid-questions get the question again"
              error={errors.first_nudge_hours?.message}
            >
              <Input
                id="s-nudge1"
                type="number"
                min={1}
                max={23}
                aria-invalid={!!errors.first_nudge_hours}
                {...register('first_nudge_hours', num)}
              />
            </FormField>
            <FormField
              id="s-nudge2"
              label="Second reminder (hours of silence)"
              required
              help="Under 24 — after that only templates are allowed"
              error={errors.second_nudge_hours?.message}
            >
              <Input
                id="s-nudge2"
                type="number"
                min={1}
                max={23}
                aria-invalid={!!errors.second_nudge_hours}
                {...register('second_nudge_hours', num)}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
