import 'server-only';
import Pusher from 'pusher';
import { config } from '../config';
import type { RealtimeClient } from './types';

// Pusher Channels. Built on first use: the keys are only set when REALTIME_MODE=pusher
// (config.ts refuses to boot without them), and this file is imported either way.
let instance: Pusher | undefined;
const pusher = () =>
  (instance ??= new Pusher({
    appId: config.PUSHER_APP_ID!,
    key: config.PUSHER_KEY!,
    secret: config.PUSHER_SECRET!,
    cluster: config.PUSHER_CLUSTER!,
    useTLS: true,
    timeout: 3000, // a bot turn waits on this, so an unreachable Pusher mustn't hold it for long
  }));

export const liveRealtime: RealtimeClient = {
  async publish(channel, event, data) {
    await pusher().trigger(channel, event, data);
  },
  authorize(socketId, channel) {
    return pusher().authorizeChannel(socketId, channel);
  },
};
