// Idempotent seed: rows are created only if missing, so re-running never clobbers edits.
// Runs outside Next (tsx), so it reads env itself instead of '@/lib/config' (which is server-only).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type LeadSource,
  type LeadStatus,
  type PaymentMethod,
  type Prisma,
} from '../src/generated/prisma/client';

const env = z
  .object({
    DATABASE_URL: z.url(),
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(8),
  })
  .parse(process.env);

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

const DAY = 86_400_000;
const now = Date.now();
const ago = (days: number, minutes = 0) => new Date(now - days * DAY + minutes * 60_000);
/** IST calendar date `days` from today, as a UTC-midnight Date for @db.Date columns. */
const istDate = (days: number) =>
  new Date(formatInTimeZone(new Date(now + days * DAY), 'Asia/Kolkata', 'yyyy-MM-dd'));

// ─── Users ───────────────────────────────────────────────────────────────────

async function seedUsers() {
  // ponytail: sales/viewer share the admin seed password; dev-only accounts.
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 10);
  const adminEmail = env.SEED_ADMIN_EMAIL.toLowerCase(); // login looks emails up lowercased
  const domain = adminEmail.split('@')[1];
  const users = [
    { name: 'Admin', email: adminEmail, role: 'ADMIN' },
    { name: 'Sales Staff', email: `sales@${domain}`, role: 'SALES' },
    { name: 'Viewer', email: `viewer@${domain}`, role: 'VIEWER' },
  ] as const;
  for (const u of users) {
    await db.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } });
  }
  return db.user.findUniqueOrThrow({ where: { email: `sales@${domain}` } });
}

// ─── Courses + batches ───────────────────────────────────────────────────────

const COURSES = {
  english: {
    id: '00000000-0000-4000-8000-000000000c01',
    name: 'Spoken English',
    description: 'Speak confidently in 8 weeks. Live classes on Zoom.',
    feePaise: 299_900,
    trialDays: null,
    sortOrder: 1,
  },
  python: {
    id: '00000000-0000-4000-8000-000000000c02',
    name: 'Python for Beginners',
    description: 'Learn to code from zero. Live classes with projects.',
    feePaise: 499_900,
    trialDays: 5,
    sortOrder: 2,
  },
} as const;

const BATCHES = {
  engMorning: {
    id: '00000000-0000-4000-8000-000000000b01',
    courseId: COURSES.english.id,
    name: 'Morning Mon–Fri',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '08:00',
    capacity: 20,
    zoomMeetingId: BigInt(81000000001),
  },
  engEvening: {
    // nearly full: 5 of 6 seats taken by the leads below
    id: '00000000-0000-4000-8000-000000000b02',
    courseId: COURSES.english.id,
    name: 'Evening Mon–Fri',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '19:00',
    endTime: '20:00',
    capacity: 6,
    zoomMeetingId: BigInt(81000000002),
  },
  pyWeekend: {
    // FULL: 4 of 4 seats taken
    id: '00000000-0000-4000-8000-000000000b03',
    courseId: COURSES.python.id,
    name: 'Weekend',
    daysOfWeek: [6, 7],
    startTime: '10:00',
    endTime: '12:00',
    capacity: 4,
    zoomMeetingId: BigInt(81000000003),
  },
  pyWeekday: {
    id: '00000000-0000-4000-8000-000000000b04',
    courseId: COURSES.python.id,
    name: 'Mon/Wed/Fri evening',
    daysOfWeek: [1, 3, 5],
    startTime: '18:30',
    endTime: '20:00',
    capacity: 15,
    zoomMeetingId: BigInt(81000000004),
  },
} as const;

type CourseKey = keyof typeof COURSES;
type BatchKey = keyof typeof BATCHES;
const courseOfBatch = (b: BatchKey): CourseKey =>
  BATCHES[b].courseId === COURSES.english.id ? 'english' : 'python';

async function seedCatalog() {
  for (const c of Object.values(COURSES)) {
    await db.course.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  for (const b of Object.values(BATCHES)) {
    await db.batch.upsert({
      where: { id: b.id },
      update: {},
      create: {
        ...b,
        daysOfWeek: [...b.daysOfWeek],
        startDate: istDate(-14),
        endDate: istDate(76),
        zoomHostUser: 'host@zoom.example',
      },
    });
  }
}

// ─── Bot questions + settings ────────────────────────────────────────────────

async function seedQuestions() {
  const questions: Prisma.QuestionCreateInput[] = [
    {
      step: 1,
      key: 'name',
      prompt: "To get started, what's your full name?",
      inputType: 'TEXT',
      optionsSource: 'STATIC',
      validationRegex: '^[\\p{L}\\p{M} ]{2,60}$',
    },
    {
      step: 2,
      key: 'course',
      prompt: 'Which course are you interested in?',
      inputType: 'LIST',
      optionsSource: 'COURSES',
    },
    {
      step: 3,
      key: 'batch',
      prompt: 'Pick a batch that suits you. All times are in IST.',
      inputType: 'LIST',
      optionsSource: 'BATCHES',
    },
    {
      step: 4,
      key: 'confirm',
      prompt: 'Please check your details and tap Confirm to book your free trial.',
      inputType: 'BUTTONS',
      optionsSource: 'STATIC',
      options: {
        create: [
          { value: 'confirm', label: 'Confirm', sortOrder: 1 },
          { value: 'change', label: 'Change', sortOrder: 2 },
        ],
      },
    },
  ];
  for (const q of questions) {
    await db.question.upsert({ where: { step: q.step }, update: {}, create: q });
  }
}

async function seedSettings() {
  const settings: Record<string, Prisma.InputJsonValue> = {
    default_trial_days: 3,
    reminder_days_before: 2,
    payment_link_expiry_hours: 72,
    welcome_text: 'Hi! Thanks for your interest in our live online classes.',
    nudge_after_hours: [3, 22],
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

// ─── Sample leads ────────────────────────────────────────────────────────────

const ADS = {
  engReel: { adId: '120210000000001', adName: 'English – Reel 1', campaignId: '120200000000001' },
  engCarousel: {
    adId: '120210000000002',
    adName: 'English – Carousel',
    campaignId: '120200000000001',
  },
  pyVideo: { adId: '120210000000003', adName: 'Python – Video', campaignId: '120200000000002' },
} as const;

type LeadSpec = {
  name: string;
  status: LeadStatus;
  daysAgo: number;
  ad?: keyof typeof ADS;
  source?: LeadSource; // default CTWA_AD when `ad` is set, else ORGANIC
  course?: CourseKey;
  batch?: BatchKey;
  step?: number; // ASKING/DROPPED/OPTED_OUT: the question they're on
  paidBy?: PaymentMethod;
  needsHuman?: boolean;
  assigned?: boolean;
};

const LEADS: LeadSpec[] = [
  { name: 'Aarav', status: 'NEW', daysAgo: 0, ad: 'engReel' },
  { name: 'Meera', status: 'NEW', daysAgo: 0 },
  { name: 'Sunita Rao', status: 'NEW', daysAgo: 1, source: 'MANUAL', assigned: true },
  { name: 'Rohan Verma', status: 'ASKING', daysAgo: 0, ad: 'engReel', step: 2 },
  {
    name: 'Sneha Iyer',
    status: 'ASKING',
    daysAgo: 1,
    ad: 'pyVideo',
    step: 3,
    course: 'python',
    needsHuman: true,
  },
  {
    name: 'Vikram Singh',
    status: 'ASKING',
    daysAgo: 0,
    ad: 'engCarousel',
    step: 4,
    batch: 'engMorning',
  },
  { name: 'Pooja Nair', status: 'DROPPED', daysAgo: 4, ad: 'engReel', step: 2 },
  {
    name: 'Arjun Mehta',
    status: 'DROPPED',
    daysAgo: 6,
    source: 'LEAD_FORM',
    step: 3,
    course: 'english',
  },
  { name: 'Kavya Reddy', status: 'QUALIFIED', daysAgo: 0, ad: 'engCarousel', batch: 'engMorning' },
  { name: 'Rahul Sharma', status: 'WAITLISTED', daysAgo: 2, ad: 'pyVideo', batch: 'pyWeekend' },
  { name: 'Ishita Gupta', status: 'WAITLISTED', daysAgo: 1, ad: 'pyVideo', batch: 'pyWeekend' },
  { name: 'Aditya Rao', status: 'TRIAL_ACTIVE', daysAgo: 1, ad: 'engReel', batch: 'engEvening' },
  {
    name: 'Neha Joshi',
    status: 'TRIAL_ACTIVE',
    daysAgo: 0,
    ad: 'engCarousel',
    batch: 'engEvening',
    needsHuman: true,
    assigned: true,
  },
  { name: 'Karan Malhotra', status: 'TRIAL_ACTIVE', daysAgo: 1, ad: 'pyVideo', batch: 'pyWeekend' },
  { name: 'Divya Menon', status: 'TRIAL_ACTIVE', daysAgo: 2, batch: 'engMorning' },
  {
    name: 'Siddharth Jain',
    status: 'PAYMENT_PENDING',
    daysAgo: 2,
    ad: 'engReel',
    batch: 'engEvening',
  },
  {
    name: 'Ananya Das',
    status: 'PAYMENT_PENDING',
    daysAgo: 4,
    ad: 'pyVideo',
    batch: 'pyWeekend',
    assigned: true,
  },
  {
    name: 'Manish Kumar',
    status: 'PAYMENT_PENDING',
    daysAgo: 4,
    ad: 'pyVideo',
    batch: 'pyWeekday',
  },
  {
    name: 'Priya Patel',
    status: 'ENROLLED',
    daysAgo: 8,
    ad: 'engReel',
    batch: 'engEvening',
    paidBy: 'RAZORPAY',
  },
  {
    name: 'Harsh Vardhan',
    status: 'ENROLLED',
    daysAgo: 10,
    ad: 'engCarousel',
    batch: 'engEvening',
    paidBy: 'CASH',
    assigned: true,
  },
  {
    name: 'Tanvi Kulkarni',
    status: 'ENROLLED',
    daysAgo: 9,
    ad: 'pyVideo',
    batch: 'pyWeekend',
    paidBy: 'RAZORPAY',
  },
  {
    name: 'Nikhil Bose',
    status: 'ENROLLED',
    daysAgo: 12,
    ad: 'pyVideo',
    batch: 'pyWeekend',
    paidBy: 'UPI_MANUAL',
  },
  { name: 'Riya Kapoor', status: 'ENROLLED', daysAgo: 15, batch: 'engMorning', paidBy: 'BANK' },
  { name: 'Amit Chauhan', status: 'EXPIRED', daysAgo: 9, ad: 'engReel', batch: 'engMorning' },
  { name: 'Swati Mishra', status: 'EXPIRED', daysAgo: 11, ad: 'pyVideo', batch: 'pyWeekday' },
  { name: 'Gaurav Saxena', status: 'OPTED_OUT', daysAgo: 5, ad: 'engReel', step: 1 },
  {
    name: 'Deepak Yadav',
    status: 'CANCELLED',
    daysAgo: 14,
    ad: 'engCarousel',
    batch: 'engMorning',
    paidBy: 'RAZORPAY',
  },
];

/** Status each sample lead passed through to reach its current one (mirrors the legal transitions). */
const PREVIOUS: Partial<Record<LeadStatus, LeadStatus>> = {
  ASKING: 'NEW',
  DROPPED: 'ASKING',
  QUALIFIED: 'ASKING',
  WAITLISTED: 'QUALIFIED',
  TRIAL_ACTIVE: 'QUALIFIED',
  PAYMENT_PENDING: 'TRIAL_ACTIVE',
  ENROLLED: 'PAYMENT_PENDING',
  EXPIRED: 'PAYMENT_PENDING',
  OPTED_OUT: 'NEW',
  CANCELLED: 'ENROLLED',
};
const pathTo = (s: LeadStatus): LeadStatus[] => (PREVIOUS[s] ? [...pathTo(PREVIOUS[s]), s] : [s]);

/** Lead statuses that come with an enrollment, and what that enrollment + its payment look like. */
const WITH_ENROLLMENT = {
  TRIAL_ACTIVE: { enrollment: 'TRIAL', payment: null },
  PAYMENT_PENDING: { enrollment: 'TRIAL', payment: 'CREATED' },
  ENROLLED: { enrollment: 'PAID', payment: 'PAID' },
  EXPIRED: { enrollment: 'EXPIRED', payment: 'EXPIRED' },
  CANCELLED: { enrollment: 'CANCELLED', payment: 'REFUNDED' },
} as const;
const hasEnrollment = (s: LeadStatus): s is keyof typeof WITH_ENROLLMENT => s in WITH_ENROLLMENT;

async function seedLeads(salesId: string) {
  for (const [i, spec] of LEADS.entries()) {
    const phoneE164 = `+9198100${String(i + 1).padStart(5, '0')}`;
    if (await db.lead.findUnique({ where: { phoneE164 } })) continue;

    const created = ago(spec.daysAgo, 9 * 60 - i * 7); // spread through the day
    let minute = 0;
    const at = () => new Date(created.getTime() + minute++ * 60_000);

    const batchKey = spec.batch;
    const courseKey = spec.course ?? (batchKey && courseOfBatch(batchKey));
    const course = courseKey && COURSES[courseKey];
    const batch = batchKey && BATCHES[batchKey];
    const firstName = spec.name.split(' ')[0];
    // "step" = question they're stuck on; past QUALIFIED they answered all 4.
    const answered = spec.step ? spec.step - 1 : spec.status === 'NEW' ? 0 : 4;

    const messages: Prisma.MessageCreateWithoutLeadInput[] = [];
    let n = 0;
    const msg = (
      direction: 'IN' | 'OUT',
      body: Prisma.InputJsonValue,
      extra: Partial<Prisma.MessageCreateWithoutLeadInput> = {},
    ) =>
      messages.push({
        direction,
        waMessageId: `wamid.seed.${phoneE164.slice(1)}.${++n}`,
        type: 'TEXT',
        body,
        // Unanswered leads' messages stay unread so the inbox has something in it.
        status:
          direction === 'OUT'
            ? 'DELIVERED'
            : spec.status === 'NEW' || spec.needsHuman
              ? 'DELIVERED'
              : 'READ',
        sentBy: direction === 'IN' ? 'lead' : 'bot',
        createdAt: at(),
        ...extra,
      });

    msg('IN', { text: spec.ad ? 'Hi! I want to know more about this.' : 'Hi' });
    if (spec.status !== 'NEW') {
      msg('OUT', {
        text: "Hi! Thanks for your interest in our live online classes.\n\nTo get started, what's your full name?",
      });
    }
    if (answered >= 1) msg('IN', { text: spec.name });
    if (answered >= 2)
      msg('IN', { text: course!.name, replyId: course!.id }, { type: 'INTERACTIVE' });
    if (answered >= 3)
      msg('IN', { text: batch!.name, replyId: batch!.id }, { type: 'INTERACTIVE' });
    if (answered >= 4) msg('IN', { text: 'Confirm', replyId: 'confirm' }, { type: 'INTERACTIVE' });
    if (spec.needsHuman) msg('IN', { text: 'Can I talk to someone about the timings?' });
    if (spec.status === 'OPTED_OUT') msg('IN', { text: 'STOP' });
    if (spec.status === 'WAITLISTED') {
      msg('OUT', {
        text: `Thanks ${firstName}! ${batch!.name} is full right now. We'll message you as soon as a seat opens.`,
      });
    }

    const answers: Prisma.AnswerCreateWithoutLeadInput[] = [];
    const answer = (questionKey: string, answerValue: string, answerLabel: string) =>
      answers.push({ questionKey, answerValue, answerLabel, answeredAt: at() });
    if (answered >= 1) answer('name', spec.name, spec.name);
    if (answered >= 2) answer('course', course!.id, course!.name);
    if (answered >= 3) answer('batch', batch!.id, batch!.name);
    if (answered >= 4) answer('confirm', 'confirm', 'Confirm');

    const enrollments: Prisma.EnrollmentCreateWithoutLeadInput[] = [];
    const method = spec.paidBy ?? 'RAZORPAY';
    const viaRazorpay = method === 'RAZORPAY';
    const template = (name: string, params: string[]) =>
      msg('OUT', { name, language: 'en', params }, { type: 'TEMPLATE', templateName: name });

    if (hasEnrollment(spec.status)) {
      const { enrollment: status, payment: paymentStatus } = WITH_ENROLLMENT[spec.status];
      const trialDays = course!.trialDays ?? 3;
      const trialEndsIn = trialDays - 1 - spec.daysAgo; // days from today to the last trial day
      const joinUrl = `https://zoom.example/j/${batch!.zoomMeetingId}?tk=seed-${i + 1}`;
      const linkUrl = `http://localhost:3000/dev/pay/plink_seed_${i + 1}`;
      const paid = paymentStatus === 'PAID' || paymentStatus === 'REFUNDED';
      const paidAt = paid ? ago(-trialEndsIn + 1) : null;

      const payments: Prisma.PaymentCreateWithoutEnrollmentInput[] = paymentStatus
        ? [
            {
              amountPaise: course!.feePaise,
              method,
              status: paymentStatus,
              ...(viaRazorpay
                ? {
                    razorpayLinkId: `plink_seed_${i + 1}`,
                    razorpayLinkUrl: linkUrl,
                    razorpayPaymentId: paid ? `pay_seed_${i + 1}` : null,
                    linkExpiresAt: ago(-trialEndsIn + 2 - 3), // requested 2 days before trial end, 72 h expiry
                  }
                : { recordedBy: { connect: { id: salesId } } }),
              paidAt,
              createdAt: ago(-trialEndsIn + 2),
            },
          ]
        : [];

      enrollments.push({
        batch: { connect: { id: batch!.id } },
        status,
        trialStart: istDate(-spec.daysAgo),
        trialEnd: istDate(trialEndsIn),
        zoomRegistrantId: status === 'TRIAL' || status === 'PAID' ? `reg_seed_${i + 1}` : null,
        zoomJoinUrl: joinUrl,
        linkSentAt: at(),
        paidAt,
        cancelledAt: status === 'CANCELLED' ? ago(2) : null,
        cancelReason: status === 'CANCELLED' ? 'Refund requested: timing clash' : null,
        payments: { create: payments },
      });

      msg('OUT', {
        text: `You're booked, ${firstName}! Your ${trialDays}-day free trial starts today.\n\nJoin here: ${joinUrl}`,
      });
      if (paymentStatus && viaRazorpay) template('trial_payment_reminder', [firstName, linkUrl]);
      if (paid) template('enrollment_confirmed', [firstName, batch!.name]);
      if (status === 'EXPIRED') template('trial_ended', [firstName]);
    }

    const actorFor: Partial<Record<LeadStatus, string>> = {
      NEW: 'webhook',
      DROPPED: 'cron',
      PAYMENT_PENDING: 'cron',
      EXPIRED: 'cron',
      ENROLLED: viaRazorpay ? 'webhook' : salesId,
      CANCELLED: salesId,
    };
    const events = pathTo(spec.status).map((toStatus, k, path) => ({
      fromStatus: k === 0 ? null : path[k - 1],
      toStatus,
      actor: actorFor[toStatus] ?? 'bot',
      createdAt: at(),
    }));

    const source = spec.source ?? (spec.ad ? 'CTWA_AD' : 'ORGANIC');
    const lastInbound = messages.findLast((m) => m.direction === 'IN')!.createdAt as Date;
    await db.lead.create({
      data: {
        phoneE164,
        waId: source === 'MANUAL' ? null : phoneE164.slice(1),
        name: answered >= 1 ? spec.name : null,
        profileName: firstName,
        course: courseKey ? { connect: { id: COURSES[courseKey].id } } : undefined,
        status: spec.status,
        currentStep: spec.status === 'ASKING' || spec.status === 'DROPPED' ? spec.step : null,
        needsHuman: spec.needsHuman ?? false,
        source,
        ...(spec.ad && { ...ADS[spec.ad], ctwaClid: `ctwa_seed_${i + 1}` }),
        lastInboundAt: source === 'MANUAL' ? null : lastInbound,
        freeWindowUntil: source === 'CTWA_AD' ? new Date(created.getTime() + 72 * 3_600_000) : null,
        optedOutAt: spec.status === 'OPTED_OUT' ? lastInbound : null,
        assignedTo: spec.assigned ? { connect: { id: salesId } } : undefined,
        notes: spec.assigned ? 'Called once, asked to follow up in the evening.' : null,
        createdAt: created,
        events: { create: events },
        answers: { create: answers },
        messages: { create: source === 'MANUAL' ? [] : messages },
        enrollments: { create: enrollments },
      },
    });
  }
}

/** Seed-only: seatsTaken = live (TRIAL/PAID) enrollments, OPEN/FULL follows it. The app uses assignSeat(). */
async function syncSeats() {
  for (const b of await db.batch.findMany({
    where: { id: { in: Object.values(BATCHES).map((b) => b.id) } },
  })) {
    const taken = await db.enrollment.count({
      where: { batchId: b.id, status: { in: ['TRIAL', 'PAID'] } },
    });
    await db.batch.update({
      where: { id: b.id },
      data: {
        seatsTaken: taken,
        status: b.status === 'CLOSED' ? 'CLOSED' : taken >= b.capacity ? 'FULL' : 'OPEN',
      },
    });
  }
}

async function main() {
  const sales = await seedUsers();
  await seedCatalog();
  await seedQuestions();
  await seedSettings();
  await seedLeads(sales.id);
  await syncSeats();
  console.log(`Seeded. Sign in as ${env.SEED_ADMIN_EMAIL}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
