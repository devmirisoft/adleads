// Zoom adapter contract. Meetings are recurring with registration on; each trial gets its own registrant.

export type Registrant = { firstName: string; lastName: string; email: string };

export type MeetingInput = {
  topic: string;
  hostUser: string;
  /** IST calendar dates and "HH:mm" IST times; days 1 = Mon … 7 = Sun. */
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
};

export interface ZoomClient {
  /** Recurring meeting with registration required. */
  createMeeting(input: MeetingInput): Promise<{ meetingId: bigint }>;
  addRegistrant(
    meetingId: bigint,
    registrant: Registrant,
  ): Promise<{ registrantId: string; joinUrl: string }>;
  /** Their personal join link stops working. */
  cancelRegistrant(meetingId: bigint, registrantId: string): Promise<void>;
}
