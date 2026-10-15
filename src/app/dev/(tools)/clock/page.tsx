import { connection } from 'next/server';
import { devNowOffsetDays, now } from '@/lib/clock';
import { DateTime, PageHeader } from '@/modules/core/components';
import { ClockControls } from './ClockControls';

export default async function DevClockPage() {
  await connection(); // shows the current time: render per request
  const [offsetDays, appNow] = await Promise.all([devNowOffsetDays(), now()]);
  return (
    <>
      <PageHeader
        title="Dev clock"
        description={`App time is ${offsetDays} day(s) ahead of real time.`}
        actions={
          <span className="text-sm text-muted-foreground">
            App now: <DateTime value={appNow} />
          </span>
        }
      />
      <ClockControls offsetDays={offsetDays} />
    </>
  );
}
