import { cn } from '@/modules/core/utils';

const SEGMENTS = 10;

/** "5 / 6 seats" with a 10-segment bar (no inline styles needed). */
export function SeatMeter({ taken, capacity }: { taken: number; capacity: number }) {
  const filled = capacity > 0 ? Math.min(SEGMENTS, Math.ceil((taken / capacity) * SEGMENTS)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm tabular-nums">
        {taken} / {capacity} seats
      </span>
      <div className="flex w-24 gap-1" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn('h-2 flex-1 rounded-full', i < filled ? 'bg-primary' : 'bg-muted')}
          />
        ))}
      </div>
    </div>
  );
}
