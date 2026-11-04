import { CopyButton } from '@/modules/core/components';

/** A batch's Zoom link, in full so staff can check it, with a copy button. */
export function ClassLink({ url, label }: { url: string; label: string }) {
  return (
    <span className="flex items-start gap-1">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 break-all text-primary underline-offset-4 hover:underline"
      >
        {url}
      </a>
      <CopyButton value={url} label={label} />
    </span>
  );
}
