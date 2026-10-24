import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/modules/core/components';
import { site } from '../constants/site';
import { WhatsAppButton } from './WhatsAppButton';

// "/#…" so the links also work from the legal pages.
const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#batches', label: 'Batches' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-site items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-semibold">
          {site.name}
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <WhatsAppButton size="lg" className="hidden sm:inline-flex" />
          {/* The only client JS on the site: the kit's Sheet. It portals out of .theme-site, so it re-applies it. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="theme-site">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <nav aria-label="Mobile" className="flex flex-col px-4">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className="border-b border-border py-3 text-base font-medium"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="px-4">
                <WhatsAppButton className="w-full" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
