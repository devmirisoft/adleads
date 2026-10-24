import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPhone } from '@/modules/core/utils';
import { site } from '@/modules/marketing';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `What personal data ${site.name} collects on WhatsApp, why, and how to have it deleted.`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {site.legalUpdated}</p>
      <p>
        {site.name} is run by {site.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), {site.address},
        India. This policy explains what personal data we collect when you contact us or join a
        class, why we collect it, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name and WhatsApp phone number.</li>
        <li>
          The messages you send us on WhatsApp and your answers to our questions, including the
          course, batch and timing you prefer.
        </li>
        <li>
          If you reach us from a Facebook or Instagram ad: which ad you came from (Meta passes this
          to us with your first message). If you fill in a form inside a Meta ad, the details you
          enter there.
        </li>
        <li>Your trial and enrollment status, and whether you have paid.</li>
        <li>
          Payment records: amount, date and the Razorpay payment reference. We never see or store
          your full card, UPI or bank details; Razorpay handles those.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To reply to your messages and answer your questions.</li>
        <li>To book you into a batch and send your class link.</li>
        <li>To send class reminders, trial reminders and payment links.</li>
        <li>To record payments and meet our tax and accounting duties.</li>
        <li>To see which of our ads bring in enquiries, using totals rather than individuals.</li>
      </ul>
      <p>
        We do not sell your personal data, and we do not share it for other companies&rsquo;
        marketing.
      </p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>
          <strong>Meta (WhatsApp Business Platform)</strong> carries our WhatsApp messages with you.
        </li>
        <li>
          <strong>Razorpay</strong> processes payments.
        </li>
        <li>
          <strong>Zoom</strong> hosts the live classes. We register you with your name and an
          address made from your phone number so you get a personal class link.
        </li>
        <li>Our hosting and database providers store the data on our behalf.</li>
      </ul>
      <p>
        These providers use your data only to provide their service to us. We may also share data
        when the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your details for [12 months] after your last message or class, then delete them.
        Payment records are kept for as long as Indian tax and accounting law requires.
      </p>

      <h2>How we protect it</h2>
      <p>
        Only staff who need your data can see it, each with their own login. Passwords are stored
        hashed, data travels over encrypted (HTTPS) connections, and card and UPI payments are
        handled entirely by Razorpay.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>Stop messages:</strong> reply STOP on WhatsApp at any time.
        </li>
        <li>
          <strong>Access and correction:</strong> ask us for a copy of your data or to correct it.
        </li>
        <li>
          <strong>Deletion:</strong> ask us to delete your data (see below).
        </li>
        <li>
          <strong>Withdraw consent:</strong> you can withdraw it at any time. This does not affect
          what we did before you withdrew it.
        </li>
      </ul>
      <p>
        These rights come from India&rsquo;s Digital Personal Data Protection Act, 2023. If you are
        unhappy with our reply, you can complain to the Data Protection Board of India.
      </p>

      <h2 id="data-deletion">Deleting your data</h2>
      <p>
        Email <a href={`mailto:${site.email}`}>{site.email}</a> or send &ldquo;DELETE MY DATA&rdquo;
        to us on WhatsApp from the number you used with us. We delete your data within 30 days and
        confirm when it is done. We keep only the payment records the law requires us to keep.
      </p>

      <h2>Children</h2>
      <p>
        Our classes are for adults. If you are under 18, please ask a parent or guardian to contact
        us.
      </p>

      <h2>Changes to this policy</h2>
      <p>If we change this policy, we will update it here and change the date at the top.</p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, email <a href={`mailto:${site.email}`}>{site.email}</a>{' '}
        or call {formatPhone(site.phone)}. More ways to reach us are on our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
    </>
  );
}
