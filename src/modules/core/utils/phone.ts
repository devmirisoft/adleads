/**
 * Any phone input → E.164, or null if it can't be a phone number.
 * Bare 10-digit numbers starting 6–9 (and 0-prefixed 11-digit ones) are Indian mobiles;
 * everything else must already carry a country code (WhatsApp wa_ids always do).
 *   "98123 45678" | "098123 45678" | "+91 98123-45678" | "919812345678" → "+919812345678"
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}

/** "+919812345678" → "+91 98123 45678". Non-Indian numbers are returned unchanged. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
