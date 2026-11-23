import { Card, CardContent } from './ui/card';

type Props = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Grid placement only, e.g. `col-span-2`. */
  className?: string;
};

export function StatTile({ label, value, hint, className }: Props) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
