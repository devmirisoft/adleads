export type BatchTiming = {
  name: string;
  days: string;
  /** IST. */
  time: string;
  mode: string;
  /** Short line under the timing. Never a made-up live seat count. */
  seatsNote: string;
};

// EXAMPLE timings: replace with your real batches.
export const batches: BatchTiming[] = [
  {
    name: 'Early morning',
    days: 'Mon–Fri',
    time: '6:00–7:00 AM',
    mode: 'Live on Zoom',
    seatsNote: 'Limited seats per batch',
  },
  {
    name: 'Morning',
    days: 'Mon–Fri',
    time: '7:30–8:30 AM',
    mode: 'Live on Zoom',
    seatsNote: 'Limited seats per batch',
  },
  {
    name: 'Evening',
    days: 'Mon–Fri',
    time: '7:00–8:00 PM',
    mode: 'Live on Zoom',
    seatsNote: 'Limited seats per batch',
  },
  {
    name: 'Weekend',
    days: 'Sat & Sun',
    time: '8:00–9:00 AM',
    mode: 'Live on Zoom',
    seatsNote: 'Limited seats per batch',
  },
];
