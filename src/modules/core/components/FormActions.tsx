/** Bottom-of-form button row: right-aligned, full-width stacked buttons on phones. */
export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">{children}</div>
  );
}
