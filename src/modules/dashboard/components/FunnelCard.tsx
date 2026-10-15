import { SectionCard, StatusBadge, type Status } from '@/modules/core/components';

/** Lead counts by status, in funnel order. */
export function FunnelCard({
  counts,
  order,
}: {
  counts: Record<string, number>;
  order: readonly Status[];
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <SectionCard
      title="Funnel"
      description={`${total} leads created in this range, by current status`}
    >
      <ul className="flex flex-col gap-2">
        {order.map((s) => (
          <li key={s} className="flex items-center justify-between gap-4 text-sm">
            <StatusBadge status={s} />
            <span className="tabular-nums">
              {counts[s] ?? 0}
              <span className="ml-2 text-xs text-muted-foreground">
                {total ? Math.round(((counts[s] ?? 0) / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
