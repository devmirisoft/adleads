import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Users,
  Video,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Money,
} from '@/modules/core/components';
import { cn } from '@/modules/core/utils';
import { batches } from '../constants/batches';
import { freeTrialDays, included, plans, pricesIncludeGst } from '../constants/pricing';
import { site } from '../constants/site';
import { WhatsAppButton } from './WhatsAppButton';

// Copy rule: no medical claims ("cure", "treat", "heal", guaranteed results) and no invented
// reviews, ratings, student counts or endorsements.

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest text-highlight-strong uppercase">
      {children}
    </p>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  muted,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-16 py-20 md:py-28', muted && 'bg-muted')}
    >
      <div className="mx-auto max-w-site px-4 sm:px-6">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          id={`${id}-title`}
          className="mt-3 max-w-2xl font-display text-3xl font-semibold text-balance md:text-4xl"
        >
          {title}
        </h2>
        {intro && <p className="mt-4 max-w-2xl text-muted-foreground">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

export function HeroSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto grid max-w-site items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Eyebrow>Live online yoga & fitness</Eyebrow>
          <h1 className="mt-4 font-display text-display font-semibold tracking-tight text-balance">
            Make time for your health, right from home.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Join a live batch from your phone or laptop, at a time that fits your day. Try it free
            for {freeTrialDays} days before you pay anything.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <WhatsAppButton className="w-full sm:w-auto">
              Start your free trial on WhatsApp
            </WhatsAppButton>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href="#batches">See batches</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No payment details needed for the trial.
          </p>
        </div>
        <div className="relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src="/hero.jpg"
            alt={site.heroImageAlt}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1120px) 528px, (min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Message us on WhatsApp',
    body: 'Tap the button and say hi. We ask a few quick questions about what you are looking for.',
  },
  {
    title: 'Pick your batch & timing',
    body: 'Choose the days and time that suit you. All timings are in IST.',
  },
  {
    title: 'Get your free trial link',
    body: 'Your personal class link arrives on WhatsApp. Join from your phone or laptop.',
  },
  {
    title: 'Continue with a plan after the trial',
    body: 'Enjoyed it? Pay securely to keep your seat. If not, there is nothing to cancel.',
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" eyebrow="How it works" title="Four simple steps to your first class">
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span aria-hidden className="font-display text-5xl font-semibold text-primary">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function BatchesSection() {
  return (
    <Section
      id="batches"
      eyebrow="Batches & timings"
      title="Pick a time that fits your day"
      intro="Every batch is live on Zoom. Timings are in IST."
      muted
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {batches.map((batch) => (
          <li key={batch.name}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="font-display text-xl font-semibold">
                  <h3>{batch.name}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-base">
                <p className="text-2xl font-semibold">{batch.time}</p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4" aria-hidden />
                  {batch.days}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Video className="size-4" aria-hidden />
                  {batch.mode}
                </p>
                <p className="text-sm text-muted-foreground">{batch.seatsNote}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-muted-foreground">
        None of these work for you? Ask us on WhatsApp about upcoming batches.
      </p>
    </Section>
  );
}

const FEATURES = [
  {
    icon: Video,
    title: 'Live classes, not recordings',
    body: 'Practise in real time with an instructor and your batch.',
  },
  {
    icon: Clock,
    title: 'Fixed timings',
    body: 'Morning, evening and weekend batches, so it becomes part of your routine.',
  },
  {
    icon: Smartphone,
    title: 'Join from anywhere',
    body: 'All you need is a phone or laptop and a little space to move.',
  },
  {
    icon: MessageCircle,
    title: 'Everything on WhatsApp',
    body: 'Your class link and reminders arrive where you already chat.',
  },
  {
    icon: Users,
    title: 'Limited seats per batch',
    body: 'Each batch has a fixed number of seats.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure payments',
    body: 'Pay through Razorpay by UPI, card or net banking. The trial is free.',
  },
];

export function FeaturesSection() {
  return (
    <Section
      id="what-you-get"
      eyebrow="What you get"
      title="Everything you need to keep showing up"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-3 text-base">
                <span className="flex size-10 items-center justify-center rounded-full bg-highlight/20">
                  <Icon className="size-5 text-highlight-strong" aria-hidden />
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PricingSection() {
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title="Simple plans, after a free trial"
      intro={
        <span className="inline-flex rounded-full bg-highlight/20 px-4 py-1 font-semibold text-foreground">
          Free trial: {freeTrialDays} days
        </span>
      }
      muted
    >
      <div className="grid gap-4 md:grid-cols-2 lg:max-w-4xl">
        {plans.map((plan) => (
          <Card key={plan.name} className={cn(plan.badge && 'ring-2 ring-primary')}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-lg font-semibold">
                <h3>{plan.name}</h3>
                {plan.badge && <Badge className="bg-highlight text-foreground">{plan.badge}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-base">
              <p>
                <span className="font-display text-4xl font-semibold">
                  <Money paise={plan.pricePaise} />
                </span>{' '}
                <span className="text-muted-foreground">{plan.period}</span>
              </p>
              <p className="text-muted-foreground">{plan.note}</p>
              <WhatsAppButton size="lg" className="self-start">
                Start with a free trial
              </WhatsAppButton>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        All prices are in ₹ and{' '}
        {pricesIncludeGst ? 'include GST.' : 'exclude GST, which is added at checkout.'}
      </p>
      <h3 className="mt-12 text-lg font-semibold">Every plan includes</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {included.map((item) => (
          <li key={item} className="flex gap-3">
            <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Is the trial really free?',
    a: `Yes. Your first ${freeTrialDays} days are free and we don't ask for payment details. If you don't continue, the trial simply ends.`,
  },
  {
    q: 'What do I need to join a class?',
    a: 'A phone, tablet or laptop with a stable internet connection, and enough space to move. A mat helps. We send the Zoom link on WhatsApp.',
  },
  {
    q: 'I have a health condition or an injury. Can I join?',
    a: 'Please check with your doctor before starting any new exercise routine, and tell your instructor about any condition or injury before class. Our classes are general fitness sessions, not medical advice or treatment.',
  },
  {
    q: 'How do I pay after the trial?',
    a: 'We send a secure Razorpay payment link on WhatsApp. You can pay by UPI, card or net banking. Your class link keeps working once the payment goes through.',
  },
  {
    q: 'Can I cancel or get a refund?',
    a: (
      <>
        Yes. Our{' '}
        <Link href="/refund-policy" className="text-primary underline underline-offset-4">
          refund policy
        </Link>{' '}
        explains when and how.
      </>
    ),
  },
  {
    q: 'How do I stop WhatsApp messages?',
    a: 'Reply STOP at any time and we will stop messaging you.',
  },
  {
    q: 'What do you do with my details?',
    a: (
      <>
        We use them only to arrange your classes and payments, and we never sell them. Read our{' '}
        <Link href="/privacy" className="text-primary underline underline-offset-4">
          privacy policy
        </Link>
        .
      </>
    ),
  },
];

export function FaqSection() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered">
      <div className="max-w-3xl divide-y divide-border border-y border-border">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {faq.q}
              <ChevronDown
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="pb-6 text-muted-foreground">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function CtaSection() {
  return (
    <section
      aria-labelledby="cta-title"
      className="bg-primary py-20 text-primary-foreground md:py-28"
    >
      <div className="mx-auto flex max-w-site flex-col items-start gap-6 px-4 sm:px-6">
        <h2 id="cta-title" className="font-display text-3xl font-semibold text-balance md:text-4xl">
          Ready for your first class?
        </h2>
        <p className="max-w-xl text-lg">
          Say hi on WhatsApp and we will help you pick a batch. Your first {freeTrialDays} days are
          free.
        </p>
        <WhatsAppButton variant="secondary">Start your free trial on WhatsApp</WhatsAppButton>
      </div>
    </section>
  );
}

/** schema.org Organization for search engines. Escapes "<" so a value can't close the script tag. */
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    email: site.email,
    telephone: site.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address,
      addressLocality: site.city,
      addressCountry: 'IN',
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
