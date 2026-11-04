'use client';

import { startTransition, useEffect, useOptimistic, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { ArrowDown, MessageCircle } from 'lucide-react';
import { leadChannel, type RealtimePublicConfig } from '@/lib/realtime/types';
import {
  Button,
  DateTime,
  EmptyState,
  Separator,
  Skeleton,
  toast,
} from '@/modules/core/components';
import type { ApiResult } from '@/modules/core/types';
import { useChatPolling } from '../hooks/useChatPolling';
import { useThreadScroll } from '../hooks/useThreadScroll';
import { sendReply, sendTemplateReply } from '../services/actions';
import type { ChatMessage, ChatPage } from '../types';
import {
  appendPending,
  bubbleKey,
  buildThread,
  firstUnreadKey,
  isLocalOnly,
} from '../utils/thread';
import { ChatBubble } from './ChatBubble';
import { ReplyBox, type TemplateOption } from './ReplyBox';

type Props = {
  leadId: string;
  initial: ChatPage;
  /** May reply, retry and send read receipts. VIEWER only watches. */
  canAct: boolean;
  windowOpen: boolean;
  optedOut: boolean;
  templates: TemplateOption[];
  realtime: RealtimePublicConfig | null;
};

type Draft = Pick<ChatMessage, 'type' | 'templateName' | 'body'>;

function presence(leadId: string, action: 'read' | 'typing') {
  void fetch(`/api/admin/leads/${leadId}/presence`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => {}); // only a courtesy to the lead's phone
}

/** A lead's WhatsApp thread and the reply box that feeds it: instant sends, live ticks, no jumping. */
export function ChatThread({
  leadId,
  initial,
  canAct,
  windowOpen,
  optedOut,
  templates,
  realtime,
}: Props) {
  const url = `/api/admin/leads/${leadId}/messages`;
  const { messages, merge, error } = useChatPolling(url, {
    initial: initial.messages,
    cursor: initial.cursor,
    realtime: { config: realtime, channel: leadChannel(leadId) },
  });
  const [withPending, addPending] = useOptimistic(messages, appendPending);
  const [retried, setRetried] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // As they were when the thread opened: the divider stays put, and a new message can reopen the window.
  const [unreadKey] = useState(() => firstUnreadKey(initial.messages));
  const [inboundAtOpen] = useState(
    () => initial.messages.findLast((m) => m.direction === 'IN')?.id,
  );
  const newestInbound = messages.findLast((m) => m.direction === 'IN')?.id;

  useEffect(() => {
    if (canAct && unreadKey) presence(leadId, 'read');
  }, [leadId, canAct, unreadKey]);

  async function loadOlder() {
    if (loadingOlder || !hasMore || !messages[0]) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`${url}?before=${messages[0].id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as ChatPage;
      merge(page.messages);
      setHasMore(page.hasMore);
    } catch {
      toast.error('Could not load older messages. Scroll up to try again.');
    } finally {
      setLoadingOlder(false);
    }
  }

  // A refused send stays visible as a failed bubble in this browser. Once retried it has no row to
  // keep it, so it goes; a saved FAILED row stays in the thread, just without Retry.
  const shown = withPending.filter((m) => !(isLocalOnly(m) && retried.includes(m.id)));
  const { ref, onScroll, newCount, jumpToBottom, stickToBottom } = useThreadScroll(
    shown.map(bubbleKey),
    () => void loadOlder(),
  );

  const send = (draft: Draft, run: (clientId: string) => Promise<ApiResult<ChatMessage>>) =>
    startTransition(async () => {
      const clientId = crypto.randomUUID();
      const pending: ChatMessage = {
        ...draft,
        body: { ...draft.body, clientId },
        id: clientId,
        direction: 'OUT',
        status: 'QUEUED',
        errorCode: null,
        sentBy: '',
        createdAt: new Date().toISOString(),
      };
      const fail = (reason: string) => {
        toast.error(reason);
        merge([{ ...pending, status: 'FAILED', errorCode: reason }]);
      };
      stickToBottom();
      addPending(pending);
      try {
        const res = await run(clientId);
        if (res.ok) merge([res.data]);
        else fail(res.error);
      } catch (e) {
        unstable_rethrow(e); // session expired: let the redirect to /login through
        fail('Could not reach the server. Check your connection and retry.');
      }
    });

  const sendText = (text: string) =>
    send({ type: 'TEXT', templateName: null, body: { text } }, (clientId) =>
      sendReply(leadId, text, clientId),
    );
  const sendTemplate = (t: TemplateOption) =>
    send({ type: 'TEMPLATE', templateName: t.name, body: { text: t.preview } }, (clientId) =>
      sendTemplateReply(leadId, t.name, t.vars, clientId),
    );

  /** A new attempt with the same content. Interactive messages can't be rebuilt, so they get no Retry. */
  function retryOf(m: ChatMessage) {
    if (!canAct || optedOut || retried.includes(m.id)) return undefined;
    const template = templates.find((t) => t.name === m.templateName);
    const text = m.type === 'TEXT' ? m.body.text : undefined;
    if (!template && !text) return undefined;
    return () => {
      setRetried((ids) => [...ids, m.id]);
      if (template) sendTemplate(template);
      else if (text) sendText(text);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-xs text-danger" role="status">
          Can’t refresh messages right now — retrying.
        </p>
      )}
      <div className="relative">
        <div
          ref={ref}
          onScroll={onScroll}
          role="log"
          aria-label="WhatsApp messages"
          tabIndex={0}
          className="flex h-96 flex-col-reverse overflow-y-auto"
        >
          <div className="flex flex-col gap-1">
            {loadingOlder && <Skeleton className="h-8 w-full" />}
            {shown.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No messages yet" />
            ) : (
              buildThread(shown, unreadKey).map((item) =>
                item.kind === 'day' ? (
                  <p
                    key={item.key}
                    className="my-2 self-center rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground"
                  >
                    <DateTime value={item.at} day />
                  </p>
                ) : item.kind === 'unread' ? (
                  <div
                    key={item.key}
                    className="my-2 flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Separator className="flex-1" />
                    Unread messages
                    <Separator className="flex-1" />
                  </div>
                ) : (
                  <ChatBubble
                    key={item.key}
                    message={item.message}
                    self="OUT"
                    startsGroup={item.startsGroup}
                    endsGroup={item.endsGroup}
                    onRetry={retryOf(item.message)}
                  />
                ),
              )
            )}
          </div>
        </div>
        {newCount > 0 && (
          <Button
            size="sm"
            className="absolute bottom-3 left-1/2 -translate-x-1/2"
            onClick={jumpToBottom}
          >
            New messages ({newCount})
            <ArrowDown className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      {canAct && (
        <>
          <Separator />
          <ReplyBox
            windowOpen={windowOpen || newestInbound !== inboundAtOpen}
            optedOut={optedOut}
            templates={templates}
            onSendText={sendText}
            onSendTemplate={sendTemplate}
            onTyping={() => presence(leadId, 'typing')}
          />
        </>
      )}
    </div>
  );
}
