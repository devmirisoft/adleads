import { devNowOffsetDays, now } from '@/lib/clock';
import { requireUser } from '@/modules/auth';
import { DateTime, PageHeader } from '@/modules/core/components';
import { devOnly } from '../../devOnly';
import { ClockControls } from './ClockControls';

export default async function DevClockPage() {
  devOnly();
  await requireUser(); // also makes this per request: it shows the current time
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
