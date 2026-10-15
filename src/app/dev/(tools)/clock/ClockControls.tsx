'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { Button, FormField, Input, SectionCard, toast } from '@/modules/core/components';
import { runCronNow, shiftClock, type CronName } from './actions';

const CRONS: { name: CronName; label: string; schedule: string }[] = [
  { name: 'jobs', label: 'Run jobs', schedule: 'Every minute' },
  {
    name: 'nudges',
    label: 'Run nudges',
    schedule: 'Every 30 min: re-ask at 3 h / 22 h, drop at 24 h',
  },
  {
    name: 'trials',
    label: 'Run trials',
    schedule: 'Daily 09:00 IST: class reminders, payment links, last day',
  },
  { name: 'expire', label: 'Run expire', schedule: 'Daily 23:30 IST: expire unpaid trials' },
];

export function ClockControls({ offsetDays }: { offsetDays: number }) {
  const router = useRouter();
  const [days, setDays] = useState(String(offsetDays));
  const [pending, start] = useTransition();

  const runCron = (name: CronName) =>
    start(async () => {
      const res = await runCronNow(name);
      if (res.ok) toast.success(res.data);
      else toast.error(res.error);
    });

  const shift = (value: number) =>
    start(async () => {
      const res = await shiftClock(value);
      if (res.ok) {
        setDays(String(res.data));
        toast.success(
          res.data ? `Clock is now ${res.data} day(s) ahead.` : 'Clock reset to real time.',
        );
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Run cron now" description="Same code the scheduled /api/cron routes run.">
        <div className="flex flex-col gap-4">
          {CRONS.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">{c.schedule}</span>
              <Button variant="outline" disabled={pending} onClick={() => runCron(c.name)}>
                <Play className="size-4" aria-hidden />
                {c.label}
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Shift time"
        description="Business rules (trial dates, reminders, the 24 h window) see now + N days. Dev only."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            shift(Number(days));
          }}
        >
          <FormField id="offset" label="Days ahead" required help="0 = real time">
            <Input
              id="offset"
              type="number"
              min={0}
              max={60}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => shift(0)}>
              Reset
            </Button>
            <Button type="submit" disabled={pending}>
              Shift clock
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
