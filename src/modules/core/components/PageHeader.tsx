import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

type Props = {
  title: string;
  description?: string;
  /** Right-aligned. At most one primary Button; others `variant="outline"` or in a menu. */
  actions?: React.ReactNode;
  backHref?: string;
};

export function PageHeader({ title, description, actions, backHref }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-2">
        {backHref && (
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref} aria-label="Back">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && (
        // Phones: actions drop under the title as full-width buttons.
        <div className="flex w-full flex-wrap items-center gap-2 *:flex-1 sm:w-auto sm:*:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
