import { randomInt, randomUUID } from 'node:crypto';
import type { ZoomClient } from './types';

/** Cancelled registrants, newest last. In-memory only (resets on restart) — for tests and dev logs. */
export const fakeZoomCancels: { meetingId: bigint; registrantId: string; at: Date }[] = [];

export const fakeZoom: ZoomClient = {
  async createMeeting() {
    // Real Zoom meeting ids are 10–11 digits.
    return { meetingId: BigInt(randomInt(1_000_000, 9_999_999)) * BigInt(10_000) };
  },
  async addRegistrant(meetingId) {
    const token = randomUUID();
    return {
      registrantId: `fake_reg_${token}`,
      joinUrl: `https://zoom.example/j/${meetingId}?tk=${token}`,
    };
  },
  async cancelRegistrant(meetingId, registrantId) {
    fakeZoomCancels.push({ meetingId, registrantId, at: new Date() });
    console.info(`[fake zoom] cancelled registrant ${registrantId} on meeting ${meetingId}`);
  },
};
