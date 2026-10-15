'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../types';

/** Polls a JSON endpoint returning `{ messages: ChatMessage[] }` every `intervalMs`. `url = null` pauses. */
export function useChatPolling(url: string | null, intervalMs = 2000) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setMessages(((await res.json()) as { messages: ChatMessage[] }).messages);
      setError(false);
    } catch {
      setError(true);
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const tick = () => !cancelled && void refresh();
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs, refresh]);

  return { messages: url ? messages : [], error, refresh };
}
