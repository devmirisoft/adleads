'use client';

import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { EmptyState } from '@/modules/core/components';
import { useChatPolling } from '../hooks/useChatPolling';
import type { ChatMessage } from '../types';
import { ChatBubble } from './ChatBubble';

/** A lead's WhatsApp thread, newest at the bottom, refreshed every 2 s. */
export function ChatThread({ leadId, initial }: { leadId: string; initial: ChatMessage[] }) {
  const { messages, error } = useChatPolling(`/api/admin/leads/${leadId}/messages`);
  const shown = messages.length ? messages : initial;
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [shown.length]);

  return (
    <div className="flex h-96 flex-col gap-3 overflow-y-auto">
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
      <div ref={bottom} />
    </div>
  );
}
