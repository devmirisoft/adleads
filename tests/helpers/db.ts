// Fixtures for database tests. Only ever runs against TEST_DATABASE_URL (see vitest.config.mts).
import { db } from '@/lib/db';
import type { LeadStatus } from '@/modules/leads';

export const hasTestDb = !!process.env.TEST_DATABASE_URL;

const TABLES = [
  'lead_events',
  'answers',
  'messages',
  'payments',
  'enrollments',
  'leads',
  'batches',
  'question_options',
  'questions',
  'courses',
  'webhook_events',
  'jobs',
  'users',
  'settings',
  'login_attempts',
];

/** Empty every table. Refuses unless DATABASE_URL is the test database. */
export async function resetDb() {
  const url = process.env.DATABASE_URL ?? '';
  if (!hasTestDb || url !== process.env.TEST_DATABASE_URL || !/test/i.test(new URL(url).pathname)) {
    throw new Error('Refusing to reset a non-test database');
  }
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

let n = 0;
const uniquePhone = () => `+9197${String(++n).padStart(8, '0')}`;

/** One course, one batch, the 4 bot questions and default settings. */
export async function seedBasics({
  capacity = 5,
  trialDays = 3,
}: { capacity?: number; trialDays?: number } = {}) {
  const course = await db.course.create({
    data: {
      name: 'Spoken English',
      description: 'Speak confidently',
      feePaise: 299_900,
      trialDays,
      sortOrder: 1,
    },
  });
  const batch = await db.batch.create({
    data: {
      courseId: course.id,
      name: 'Evening Mon–Fri',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '19:00',
      endTime: '20:00',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2099-12-31'),
      capacity,
      zoomMeetingId: BigInt(81000000002),
      zoomHostUser: 'host@zoom.example',
    },
  });
  const q = (
    step: number,
    key: string,
    prompt: string,
    inputType: 'TEXT' | 'LIST' | 'BUTTONS',
    optionsSource: 'STATIC' | 'COURSES' | 'BATCHES',
  ) => db.question.create({ data: { step, key, prompt, inputType, optionsSource } });
  await q(1, 'name', "What's your full name?", 'TEXT', 'STATIC');
  await q(2, 'course', 'Which course?', 'LIST', 'COURSES');
  await q(3, 'batch', 'Pick a batch.', 'LIST', 'BATCHES');
  const confirm = await q(4, 'confirm', 'Tap Confirm to book.', 'BUTTONS', 'STATIC');
  await db.questionOption.createMany({
    data: [
      { questionId: confirm.id, value: 'confirm', label: 'Confirm', sortOrder: 1 },
      { questionId: confirm.id, value: 'change', label: 'Change', sortOrder: 2 },
    ],
  });
  return { course, batch };
}

/** A lead in any status, written directly (test setup only — the app goes through transition()). */
export function makeLead(
  status: LeadStatus = 'NEW',
  extra: { courseId?: string; name?: string } = {},
) {
  return db.lead.create({
    data: {
      phoneE164: uniquePhone(),
      waId: 'x',
      name: extra.name ?? 'Test Lead',
      source: 'ORGANIC',
      status,
      courseId: extra.courseId,
      lastInboundAt: new Date(), // inside the 24 h window
    },
  });
}

export { db };
