import type { Metadata } from 'next';
import Link from 'next/link';
import { freeTrialDays, site } from '@/modules/marketing';

export const metadata: Metadata = {
  title: 'Cancellation & refund policy',
  description: `When and how ${site.name} refunds payments for classes.`,
};

// [BRACKETED] values are business decisions: set them before launch (Razorpay reviews this page).
export default function RefundPolicyPage() {
  return (
    <>
      <h1>Cancellation &amp; refund policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {site.legalUpdated}</p>
      <p>
        This policy covers payments made to {site.legalName} for {site.name} classes.
      </p>

      <h2>Free trial</h2>
      <p>
        The {freeTrialDays}-day trial is free, so there is nothing to pay or refund. If you
        don&rsquo;t continue, the trial ends on its own.
      </p>

      <h2>If you cancel</h2>
      <ul>
        <li>
          Cancel within [7] days of your payment and you get a [full] refund, as long as you have
          attended no more than [2] paid classes.
        </li>
        <li>
          After that, payments for the current period are not refundable. Your class link keeps
          working until the period you paid for ends.
        </li>
        <li>To stop, simply don&rsquo;t renew. Nothing renews automatically.</li>
      </ul>

      <h2>If we cancel</h2>
      <p>
        If we cancel or stop a batch and can&rsquo;t move you to another batch that suits you, we
        refund the unused part of your payment.
      </p>

      <h2>How to ask for a refund</h2>
      <p>
        Message us on WhatsApp or email <a href={`mailto:${site.email}`}>{site.email}</a> with your
        name, phone number and the Razorpay payment ID from your receipt. We reply within [2]
        working days.
      </p>
      <p>
        Approved refunds go back to the original payment method through Razorpay. Banks usually take
        5–7 working days to show the money in your account.
      </p>

      <h2>Contact</h2>
      <p>
        {site.legalName}, {site.address}, India · <a href={`mailto:${site.email}`}>{site.email}</a>{' '}
        · <Link href="/contact">all contact details</Link>
      </p>
    </>
  );
}
