'use client';

import { List } from 'lucide-react';
import { Button, DateTime, StatusBadge } from '@/modules/core/components';
import { cn } from '@/modules/core/utils';
import type { ChatButton, ChatMessage, ChatRow } from '../types';

type Props = {
  message: ChatMessage;
  /** Which side is "me": the lead (simulator) or the business (admin thread). */
  self: 'IN' | 'OUT';
  /** Makes buttons/list rows tappable (simulator only). */
  onTap?: (choice: { kind: 'button' | 'list' | 'template_button' } & ChatButton) => void;
};

/** One WhatsApp message: text, template, reply buttons or list rows, with time and failures. */
export function ChatBubble({ message: m, self, onTap }: Props) {
  const mine = m.direction === self;
  const tapKind = m.type === 'TEMPLATE' ? 'template_button' : 'button';
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-xs rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
          mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {m.type === 'TEMPLATE' && (
          <p className={cn('text-xs', mine ? 'opacity-80' : 'text-muted-foreground')}>
            Template · {m.templateName}
          </p>
        )}
        {m.body.text ?? (m.type === 'MEDIA' ? 'Media message' : '')}
      </div>
      {m.body.buttons && (
        <div className="flex max-w-xs flex-wrap gap-2">
          {m.body.buttons.map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant="outline"
              disabled={!onTap}
              onClick={() => onTap?.({ kind: tapKind, ...b })}
            >
              {b.title}
            </Button>
          ))}
        </div>
      )}
      {m.body.rows && <ListRows button={m.body.button} rows={m.body.rows} onTap={onTap} />}
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <DateTime value={m.createdAt} relative />
        {m.status === 'FAILED' && <StatusBadge status="FAILED" />}
      </span>
      {m.status === 'FAILED' && m.errorCode && (
        <span className="max-w-xs text-xs text-danger">{m.errorCode}</span>
      )}
    </div>
  );
}

function ListRows({
  button,
  rows,
  onTap,
}: {
  button?: string;
  rows: ChatRow[];
  onTap?: Props['onTap'];
}) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1 rounded-lg border border-border p-2">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <List className="size-4" aria-hidden />
        {button ?? 'Options'}
      </span>
      {rows.map((r) => (
        <Button
          key={r.id}
          variant="ghost"
          className="h-auto flex-col items-start gap-0 px-2 py-1 text-left whitespace-normal"
          disabled={!onTap}
          onClick={() => onTap?.({ kind: 'list', id: r.id, title: r.title })}
        >
          <span className="text-sm">{r.title}</span>
          {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
        </Button>
      ))}
    </div>
  );
}
