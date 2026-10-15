/** Page `searchParams` → one string per key (repeated keys keep the first), ready for a zod filter schema. */
export function flatParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
