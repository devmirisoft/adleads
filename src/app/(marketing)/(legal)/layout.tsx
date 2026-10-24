// One readable column for the policy pages and contact. Text links are styled here; kit Buttons
// (data-slot) keep their own look.
export default function LegalLayout({ children }: LayoutProps<'/'>) {
  return (
    <article className="mx-auto max-w-prose px-4 py-16 md:py-20 [&_a:not([data-slot])]:text-primary [&_a:not([data-slot])]:underline [&_a:not([data-slot])]:underline-offset-4 [&_h1]:font-display [&_h1]:text-4xl [&_h1]:font-semibold [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
      {children}
    </article>
  );
}
