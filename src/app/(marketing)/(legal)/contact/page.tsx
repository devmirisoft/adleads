import type { Metadata } from 'next';
import { formatPhone } from '@/modules/core/utils';
import { site, WhatsAppButton } from '@/modules/marketing';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Contact ${site.name}: WhatsApp, email, phone and address.`,
};

export default function ContactPage() {
  return (
    <>
      <h1>Contact us</h1>
      <p>The quickest way to reach us is WhatsApp.</p>
      <div className="mt-6">
        <WhatsAppButton />
      </div>

      <h2>Details</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold">Business</dt>
        <dd>
          {site.legalName} (trading as {site.name})
        </dd>
        <dt className="font-semibold">Address</dt>
        <dd>{site.address}, India</dd>
        <dt className="font-semibold">Email</dt>
        <dd>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </dd>
        <dt className="font-semibold">Phone</dt>
        <dd>
          <a href={`tel:${site.phone}`}>{formatPhone(site.phone)}</a>
        </dd>
      </dl>
    </>
  );
}
