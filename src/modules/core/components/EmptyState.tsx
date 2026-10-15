import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="mb-2 rounded-full bg-muted p-3 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
