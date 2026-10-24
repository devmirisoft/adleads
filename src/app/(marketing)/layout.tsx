import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import { site, SiteFooter, SiteHeader } from '@/modules/marketing';

// Loaded here, not in the root layout, so staff pages don't download it.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'opsz'],
  variable: '--font-fraunces',
});

const title = `${site.name} — ${site.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: title, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: {
    type: 'website',
    siteName: site.name,
    title,
    description: site.description,
    locale: 'en_IN',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: site.name }],
  },
};

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div
      className={`${fraunces.variable} theme-site flex min-h-screen flex-col bg-background text-body text-foreground`}
    >
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
