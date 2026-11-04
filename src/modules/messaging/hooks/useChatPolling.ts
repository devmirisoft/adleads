'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeChannel } from '@/lib/realtime/browser';
import type { RealtimePublicConfig } from '@/lib/realtime/types';
import type { ChatEvent, ChatMessage } from '../types';
import { mergeMessages, nextPollDelay } from '../utils/thread';

type Options = {
  initial?: ChatMessage[];
  /** From the server render, so the first fetch only asks for what changed after it. */
  cursor?: string;
  /** Push updates on this channel. Polling stops while they flow and resumes if they drop. */
  realtime?: { config: RealtimePublicConfig | null; channel: string };
};

/**
 * Keeps a thread fresh from an endpoint returning `{ messages, cursor? }`, merging rows in so the
 * list never jumps. `url = null` stops; a hidden tab pauses; idle threads poll less often.
 */
export function useChatPolling(
  url: string | null,
  { initial = [], cursor: firstCursor, realtime }: Options = {},
) {
  const [messages, setMessages] = useState(initial);
  const [error, setError] = useState(false);
  const [heldUrl, setHeldUrl] = useState(url);
  if (url !== heldUrl) {
    setHeldUrl(url);
    setMessages(initial); // a different thread: start over
  }

  const cursor = useRef(firstCursor);
  const lastChange = useRef(0);
  const currentUrl = useRef(url);
  useEffect(() => {
    currentUrl.current = url;
  }, [url]);

  const merge = useCallback((incoming: ChatMessage[]) => {
    lastChange.current = Date.now();
    setMessages((held) => mergeMessages(held, incoming));
  }, []);

  const refresh = useCallback(async () => {
    if (!url) return;
    const target = new URL(url, location.origin);
    if (cursor.current) target.searchParams.set('after', cursor.current);
    try {
      const res = await fetch(target, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { messages: ChatMessage[]; cursor?: string };
      if (currentUrl.current !== url) return; // a reply for the previous thread
      if (page.cursor) cursor.current = page.cursor;
      if (page.messages.length) merge(page.messages);
      setError(false);
    } catch {
      setError(true);
    }
  }, [url, merge]);

  const connected = useRealtimeChannel(
    realtime?.config,
    realtime?.channel ?? '',
    (_event, data) => {
      const { message } = data as ChatEvent;
      if (message) merge([message]);
      else void refresh();
    },
  );

  useEffect(() => {
    if (!url) return;
    lastChange.current = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    // Waits for each reply before scheduling the next, so a slow network can't pile requests up.
    const schedule = () => {
      clearTimeout(timer);
      const delay = nextPollDelay({
        realtime: connected,
        hidden: document.hidden,
        idleMs: Date.now() - lastChange.current,
      });
      if (delay === null) return;
      timer = setTimeout(() => {
        void refresh().finally(() => {
          if (!stopped) schedule();
        });
      }, delay);
    };
    const onVisibility = () => {
      if (!document.hidden) {
        lastChange.current = Date.now();
        void refresh(); // back on the tab: catch up now
      }
      schedule();
    };
    // Catch up on load and whenever realtime connects or drops: events can be missed in between.
    const catchUp = setTimeout(() => void refresh(), 0);
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(catchUp);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [url, connected, refresh]);

  return { messages, merge, error: error && !connected, refresh };
}
