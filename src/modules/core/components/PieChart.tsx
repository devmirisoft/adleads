export type PieSlice = { label: string; value: number };

// Literal class names so Tailwind generates them. Fixed slot order (validated palette in
// globals.css); the 6th slot is the grey "Other" slice.
const COLORS = [
  ['stroke-chart-1', 'bg-chart-1'],
  ['stroke-chart-2', 'bg-chart-2'],
  ['stroke-chart-3', 'bg-chart-3'],
  ['stroke-chart-4', 'bg-chart-4'],
  ['stroke-chart-5', 'bg-chart-5'],
  ['stroke-muted-foreground', 'bg-muted-foreground'],
] as const;

/** Largest first, zeros dropped. More than 5 parts → the top 5 plus one "Other" slice. */
export function pieSlices(data: PieSlice[], otherLabel = 'Other'): PieSlice[] {
  const sorted = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= 5) return sorted;
  const rest = sorted.slice(5).reduce((sum, d) => sum + d.value, 0);
  return [...sorted.slice(0, 5), { label: otherLabel, value: rest }];
}

type Props = {
  data: PieSlice[];
  /** Shown when every value is 0. */
  emptyState: React.ReactNode;
  /** Label for the folded tail when there are more than 5 parts. */
  otherLabel?: string;
};

/** One whole split into parts: a donut plus a legend with each part's count and share. */
export function PieChart({ data, emptyState, otherLabel }: Props) {
  const slices = pieSlices(data, otherLabel);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (!total) return emptyState;

  const pcts = slices.map((s) => (s.value / total) * 100);
  const starts = pcts.map((_, i) => pcts.slice(0, i).reduce((a, b) => a + b, 0));
  const gap = slices.length > 1 ? 0.5 : 0; // thin background gap between slices

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {/* The legend carries every figure, so the drawing is hidden from screen readers. */}
      <svg viewBox="0 0 42 42" className="size-40 shrink-0 -rotate-90" aria-hidden>
        {slices.map((s, i) => {
          const len = Math.max(pcts[i] - gap, 0);
          return (
            <circle
              key={i}
              cx="21"
              cy="21"
              r="15.9155"
              pathLength={100}
              fill="none"
              strokeWidth="6"
              className={COLORS[i][0]}
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={-starts[i]}
            >
              <title>{`${s.label}: ${s.value} (${Math.round(pcts[i])}%)`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="flex min-w-48 flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={`size-3 shrink-0 rounded-full ${COLORS[i][1]}`} aria-hidden />
            <span className="flex-1 truncate" title={s.label}>
              {s.label}
            </span>
            <span className="tabular-nums">
              {s.value}
              <span className="ml-2 text-xs text-muted-foreground">{Math.round(pcts[i])}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
