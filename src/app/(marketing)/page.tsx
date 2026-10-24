import {
  BatchesSection,
  CtaSection,
  FaqSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  OrganizationJsonLd,
  PricingSection,
} from '@/modules/marketing';

// Public landing page, the same for signed-in staff and visitors.
export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <HeroSection />
      <HowItWorksSection />
      <BatchesSection />
      <FeaturesSection />
      <PricingSection />
      {/* <Testimonials /> — only real, attributable reviews with permission. Never invent them. */}
      <FaqSection />
      <CtaSection />
    </>
  );
}
