'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { mergeMessages } from '../utils/mergeMessages';

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10_000; // the next poll waits for this one, so a hung request mustn't stop polling

/**
 * Keeps a thread fresh from a JSON endpoint returning `{ messages: ChatMessage[], at?: string }`.
 * The first read takes the whole thread; after that it asks only for rows changed since the last
 * reply's `at` (tick changes on older messages included) and merges them in. An endpoint with no
 * `at` is read in full each time. `url = null` stops; a hidden tab pauses.
 */
export function useChatPolling(url: string | null, initial: ChatMessage[] = []) {
  const [messages, setMessages] = useState(initial);
  const [error, setError] = useState(false);
  const [heldUrl, setHeldUrl] = useState(url);
  if (url !== heldUrl) {
    setHeldUrl(url);
    setMessages(initial); // a different thread: start over
  }

  const cursor = useRef({ url, since: '' });

  const merge = useCallback(
    (incoming: ChatMessage[]) => setMessages((held) => mergeMessages(held, incoming)),
    [],
  );

  const refresh = useCallback(async () => {
    if (!url) return;
    if (cursor.current.url !== url) cursor.current = { url, since: '' };
    const target = new URL(url, location.origin);
    if (cursor.current.since) target.searchParams.set('since', cursor.current.since);
    try {
      const res = await fetch(target, {
        cache: 'no-store',
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { messages: changed, at } = (await res.json()) as {
        messages: ChatMessage[];
        at?: string;
      };
      if (cursor.current.url === url) {
        merge(changed); // otherwise it's a late reply for the previous thread
        cursor.current.since = at ?? '';
      }
      setError(false);
    } catch {
      setError(true);
    }
  }, [url, merge]);

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    // Waits for each reply before scheduling the next, so a slow network can't pile requests up.
    const poll = async () => {
      if (!document.hidden) await refresh();
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    const onVisibility = () => {
      if (!document.hidden) void refresh(); // back on the tab: catch up now
    };
    void poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [url, refresh]);

  return { messages, merge, error, refresh };
}
