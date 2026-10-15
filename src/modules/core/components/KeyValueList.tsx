type Props = { items: { label: string; value: React.ReactNode }[] };

/** Label/value rows for detail pages. Pass `null` values as "—" yourself if needed. */
export function KeyValueList({ items }: Props) {
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="col-span-2 min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
