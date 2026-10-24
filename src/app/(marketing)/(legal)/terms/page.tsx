import type { Metadata } from 'next';
import Link from 'next/link';
import { freeTrialDays, pricesIncludeGst, site } from '@/modules/marketing';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: `The terms for ${site.name} trials, classes and payments.`,
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {site.legalUpdated}</p>
      <p>
        These terms apply when you book a trial or join a class with {site.name}, run by{' '}
        {site.legalName}, {site.address}, India. By booking a trial or paying for a plan, you agree
        to them.
      </p>

      <h2>Our classes</h2>
      <p>
        We run live online group classes on Zoom in fixed batches. Each batch has set days, a set
        time (IST) and a limited number of seats. We may change a batch&rsquo;s timing or
        instructor; if we do, we will tell you on WhatsApp first and offer you another batch.
      </p>

      <h2>Free trial</h2>
      <ul>
        <li>
          New members get a free trial of {freeTrialDays} days in one batch. One trial per person.
        </li>
        <li>We send your personal class link on WhatsApp. Please don&rsquo;t share it.</li>
        <li>
          If you don&rsquo;t continue with a paid plan, the trial ends on its own and the link stops
          working. There is nothing to cancel.
        </li>
      </ul>

      <h2>Payment</h2>
      <ul>
        <li>
          After the trial we send a Razorpay payment link on WhatsApp. Prices are in Indian rupees
          and {pricesIncludeGst ? 'include GST' : 'exclude GST, which is added at checkout'}.
        </li>
        <li>Your seat and class link stay active for the period you have paid for.</li>
        <li>If a payment is not made by the due date, your seat may be given to someone else.</li>
      </ul>

      <h2>Cancellations and refunds</h2>
      <p>
        See our <Link href="/refund-policy">refund policy</Link>.
      </p>

      <h2>Your health</h2>
      <p>
        Our classes are general fitness sessions, not medical advice or treatment. Check with your
        doctor before starting any new exercise routine, tell your instructor about any injury or
        condition, and stop if anything feels wrong. You take part at your own risk.
      </p>

      <h2>Conduct</h2>
      <p>
        Please be respectful to instructors and other members. We may remove anyone who disrupts a
        class or shares their link, without a refund for the remaining period.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, our total liability to you is limited to the amount you paid
        us in the last three months. We are not responsible for problems with your own internet
        connection or device.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts in {site.city} have jurisdiction.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${site.email}`}>{site.email}</a> or our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
    </>
  );
}
