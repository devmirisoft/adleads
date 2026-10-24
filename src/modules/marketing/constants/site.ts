/**
 * Business details for the public site — the one place to change them.
 * Replace every [BRACKETED] value before launch (search the repo for "[").
 */
export const site = {
  name: 'The Health Matters',
  /** Page title: "The Health Matters — <tagline>". */
  tagline: 'Live online yoga & fitness classes',
  description:
    'Live online yoga and fitness batches for working professionals. Morning and evening slots, and a free trial on WhatsApp.',
  url: 'https://adleads-eight.vercel.app',
  legalName: '[LEGAL NAME AS ON GST/REGISTRATION]',
  address: '[FULL ADDRESS]',
  city: '[CITY]',
  email: '[EMAIL]',
  /** E.164, e.g. +919812345678 (shown as +91 98123 45678). */
  phone: '[PHONE]',
  /** Digits only, country code first, e.g. 919812345678. */
  whatsappNumber: '[91XXXXXXXXXX]',
  whatsappText: "Hi, I'd like to join a free trial",
  /** Describe what the photo in public/hero.jpg actually shows. */
  heroImageAlt:
    'A woman doing a seated stretch on a yoga mat at home, following a live class on her laptop',
  /** Shown on the privacy, terms and refund pages. */
  legalUpdated: '24 October 2026',
} as const;

export const whatsappUrl = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(site.whatsappText)}`;
