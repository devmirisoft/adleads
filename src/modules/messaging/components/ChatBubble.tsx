'use client';

import { useState } from 'react';
import { List, RotateCw } from 'lucide-react';
import {
  Button,
  DateTime,
  MessageTicks,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/modules/core/components';
import { cn } from '@/modules/core/utils';
import type { ChatButton, ChatMessage, ChatRow } from '../types';

type Props = {
  message: ChatMessage;
  /** Which side is "me": the lead (simulator) or the business (admin thread). */
  self: 'IN' | 'OUT';
  /** Makes buttons/list rows tappable (simulator only). */
  onTap?: (choice: { kind: 'button' | 'list' | 'template_button' } & ChatButton) => void;
  /** Failed bubbles offer this as a Retry action. */
  onRetry?: () => void;
  /** Grouped bubbles (same side, within 2 min) share one tail and one timestamp. */
  startsGroup?: boolean;
  endsGroup?: boolean;
};

/** One WhatsApp message: text, template, reply buttons or list rows, with time and ticks in the corner. */
export function ChatBubble({
  message: m,
  self,
  onTap,
  onRetry,
  startsGroup = true,
  endsGroup = true,
}: Props) {
  const mine = m.direction === self;
  const tapKind = m.type === 'TEMPLATE' ? 'template_button' : 'button';
  const sent = m.direction === 'OUT';
  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        mine ? 'items-end' : 'items-start',
        startsGroup && 'mt-2',
      )}
    >
      <div
        className={cn(
          'flex max-w-xs flex-col gap-1 rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
          mine ? 'bg-primary/10' : 'bg-muted',
          startsGroup && (mine ? 'rounded-tr-none' : 'rounded-tl-none'),
        )}
      >
        {m.type === 'TEMPLATE' && (
          <p className="text-xs text-muted-foreground">Template · {m.templateName}</p>
        )}
        {!sent && m.type === 'INTERACTIVE' && (
          <p className="text-xs text-muted-foreground">Chose an option</p>
        )}
        <span>{m.body.text ?? (m.type === 'MEDIA' ? 'Media message' : '')}</span>
        {!onTap && m.body.buttons && <Options options={m.body.buttons} />}
        {!onTap && m.body.rows && <Options label={m.body.button} options={m.body.rows} />}
        {(endsGroup || sent) && (
          <span className="flex items-center gap-1 self-end text-xs text-muted-foreground">
            {endsGroup && <DateTime value={m.createdAt} timeOnly />}
            {sent &&
              (m.status === 'FAILED' ? (
                <FailedDetails error={m.errorCode} onRetry={onRetry} />
              ) : (
                <MessageTicks status={m.status} />
              ))}
          </span>
        )}
      </div>
      {onTap && m.body.buttons && (
        <div className="flex max-w-xs flex-wrap gap-2">
          {m.body.buttons.map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant="outline"
              onClick={() => onTap({ kind: tapKind, ...b })}
            >
              {b.title}
            </Button>
          ))}
        </div>
      )}
      {onTap && m.body.rows && <ListRows button={m.body.button} rows={m.body.rows} onTap={onTap} />}
    </div>
  );
}

/** The red "!": tap for the reason and, when there is one, a new attempt. */
function FailedDetails({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Message not sent. Show why.">
          <MessageTicks status="FAILED" className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="text-sm font-medium">This message wasn’t sent.</p>
        {error && (
          <p className="text-xs break-words text-danger">{error.replace(/^\w+Error: /, '')}</p>
        )}
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen(false);
              onRetry();
            }}
          >
            <RotateCw className="size-4" aria-hidden />
            Retry
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** What the bot offered, read-only: staff read the choices here, they don't tap them. */
function Options({ label, options }: { label?: string; options: (ChatButton | ChatRow)[] }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
      {label && (
        <span className="flex items-center gap-1 font-medium">
          <List className="size-4" aria-hidden />
          {label}
        </span>
      )}
      <ul className="flex flex-col gap-1">
        {options.map((o) => (
          <li key={o.id}>{o.title}</li>
        ))}
      </ul>
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
  onTap: NonNullable<Props['onTap']>;
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
          onClick={() => onTap({ kind: 'list', id: r.id, title: r.title })}
        >
          <span className="text-sm">{r.title}</span>
          {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
        </Button>
      ))}
    </div>
  );
}
