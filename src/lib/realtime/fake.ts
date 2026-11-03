import type { RealtimeClient } from './types';

// REALTIME_MODE=off: nothing is pushed, so chat threads fall back to polling.
export const fakeRealtime: RealtimeClient = {
  async publish() {},
  authorize: () => null,
};
