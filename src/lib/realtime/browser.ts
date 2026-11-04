'use client';

import { useEffect, useRef, useState } from 'react';
import type Pusher from 'pusher-js';
import type { RealtimePublicConfig } from './types';

// One socket per tab, and the library only loads when realtime is on.
let connection: Promise<Pusher> | undefined;
const connect = (key: string, cluster: string) =>
  (connection ??= import('pusher-js').then(
    ({ default: Client }) =>
      new Client(key, {
        cluster,
        channelAuthorization: { endpoint: '/api/realtime/auth', transport: 'ajax' },
      }),
  ));

/**
 * Listens to one private channel; one caller per channel, since leaving unsubscribes it.
 * Returns true only while events are really flowing, so callers know when they must poll instead.
 */
export function useRealtimeChannel(
  config: RealtimePublicConfig | null | undefined,
  channel: string,
  onEvent: (event: string, data: unknown) => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  const key = config?.key;
  const cluster = config?.cluster;
  useEffect(() => {
    if (!key || !cluster) return;
    let stopped = false;
    let stop = () => {};
    connect(key, cluster)
      .then((pusher) => {
        if (stopped) return;
        const sub = pusher.subscribe(channel);
        const sync = () => setConnected(pusher.connection.state === 'connected' && sub.subscribed);
        const dispatch = (event: string, data: unknown) => {
          if (!event.startsWith('pusher:')) handler.current(event, data);
        };
        sub.bind('pusher:subscription_succeeded', sync);
        sub.bind('pusher:subscription_error', sync);
        sub.bind_global(dispatch);
        pusher.connection.bind('state_change', sync);
        sync();
        stop = () => {
          pusher.connection.unbind('state_change', sync);
          sub.unbind('pusher:subscription_succeeded', sync);
          sub.unbind('pusher:subscription_error', sync);
          sub.unbind_global(dispatch);
          pusher.unsubscribe(channel);
          setConnected(false);
        };
      })
      .catch(() => {}); // the library failed to load: stay disconnected, so callers keep polling
    return () => {
      stopped = true;
      stop();
    };
  }, [key, cluster, channel]);

  return connected;
}
