'use client';

import { startTransition, useEffect, useOptimistic, useRef } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { EmptyState, Separator, toast } from '@/modules/core/components';
import type { ApiResult } from '@/modules/core/types';
import { useChatPolling } from '../hooks/useChatPolling';
import type { ChatMessage } from '../types';
import { ChatBubble } from './ChatBubble';
import { ReplyBox, type SendMessage, type TemplateOption } from './ReplyBox';

const NEAR_BOTTOM_PX = 48;

type Props = {
  leadId: string;
  initial: ChatMessage[];
  /** Shows the reply box. */
  canAct: boolean;
  windowOpen: boolean;
  optedOut: boolean;
  templates: TemplateOption[];
};

/** A lead's WhatsApp thread, newest at the bottom, and the reply box that feeds it. */
export function ChatThread({ leadId, initial, canAct, windowOpen, optedOut, templates }: Props) {
  const { messages, merge, error } = useChatPolling(`/api/admin/leads/${leadId}/messages`, initial);
  const [shown, addOptimistic] = useOptimistic(messages, (all: ChatMessage[], m: ChatMessage) =>
    all.some((held) => held.id === m.id) ? all : [...all, m],
  );

  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    if (atBottom.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown.length]);

  const send: SendMessage = (draft, run, restore) =>
    startTransition(async () => {
      const id = crypto.randomUUID(); // the row's id too, so a poll that beats the action can't double the bubble
      const at = new Date().toISOString();
      atBottom.current = true; // your own message always scrolls into view
      addOptimistic({
        ...draft,
        id,
        direction: 'OUT',
        status: 'QUEUED',
        errorCode: null,
        sentBy: '',
        createdAt: at,
        updatedAt: at,
      });
      const res = await run(id).catch((e: unknown): ApiResult<ChatMessage> => {
        unstable_rethrow(e); // session expired: let the redirect to /login through
        return {
          ok: false,
          error: 'Could not reach the server. Check your connection and try again.',
        };
      });
      if (res.ok) {
        startTransition(() => merge([res.data]));
      } else {
        toast.error(res.error);
        restore();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={box}
        className="flex h-96 flex-col gap-3 overflow-y-auto"
        onScroll={({ currentTarget: el }) => {
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        }}
      >
        {error && (
          <p className="text-xs text-danger" role="status">
            Can’t refresh messages right now — retrying.
          </p>
        )}
        {shown.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No messages yet" />
        ) : (
          shown.map((m) => <ChatBubble key={m.id} message={m} self="OUT" />)
        )}
      </div>
      {canAct && (
        <>
          <Separator />
          <ReplyBox
            leadId={leadId}
            windowOpen={windowOpen}
            optedOut={optedOut}
            templates={templates}
            onSend={send}
          />
        </>
      )}
    </div>
  );
}
