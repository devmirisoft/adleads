import 'server-only';
import type { ZoomClient } from './types';

// TODO(live): Zoom Server-to-Server OAuth, using config.ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET.
//  - Token: POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id={ZOOM_ACCOUNT_ID}
//    (Basic auth client_id:client_secret); cache until expires_in − 60 s.
//  - createMeeting: POST https://api.zoom.us/v2/users/{hostUser}/meetings
//    body { topic, type: 8 (recurring, fixed time), start_time (first class, IST), duration, timezone: "Asia/Kolkata",
//      recurrence: { type: 2 (weekly), weekly_days (Zoom: 1=Sun…7=Sat — convert), end_date_time },
//      settings: { approval_type: 0 (auto-approve registrants), registration_type: 1 } } → { meetingId: BigInt(id) }
//  - addRegistrant: POST https://api.zoom.us/v2/meetings/{meetingId}/registrants
//    body { first_name, last_name, email } → { registrantId: id, joinUrl: join_url }
//  - cancelRegistrant: PUT https://api.zoom.us/v2/meetings/{meetingId}/registrants/status
//    body { action: "cancel", registrants: [{ id: registrantId }] }
//  - Treat 404 "registrant not found" on cancel as success (already gone).
const notImplemented = (): never => {
  throw new Error('Not implemented: live Zoom adapter');
};

export const liveZoom: ZoomClient = {
  createMeeting: notImplemented,
  addRegistrant: notImplemented,
  cancelRegistrant: notImplemented,
};
