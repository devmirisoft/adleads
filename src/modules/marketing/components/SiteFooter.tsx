import Link from 'next/link';
import { cacheLife } from 'next/cache';
import { formatPhone } from '@/modules/core/utils';
import { site } from '../constants/site';

// No sign-in link here or anywhere on the public site: staff go to /login directly.
const LINKS = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of service' },
  { href: '/refund-policy', label: 'Refund policy' },
  { href: '/contact', label: 'Contact' },
];

// Cached so the page can still be prerendered (Cache Components forbids a bare new Date()).
async function currentYear() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

export async function SiteFooter() {
  const year = await currentYear();
  return (
    <footer className="border-t border-border bg-muted text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-site flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="font-display text-lg font-semibold text-foreground">{site.name}</p>
          <p>
            {site.legalName} · {site.city}, India
          </p>
          <p>
            <a href={`mailto:${site.email}`} className="hover:text-foreground">
              {site.email}
            </a>
            {' · '}
            <a href={`tel:${site.phone}`} className="hover:text-foreground">
              {formatPhone(site.phone)}
            </a>
          </p>
        </div>
        <nav aria-label="Legal">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-site border-t border-border px-4 py-6 text-xs sm:px-6">
        © {year} {site.legalName}. All rights reserved.
      </p>
    </footer>
  );
}
