// ponytail: fixed word list, catches replies made only of greetings/filler. "Hi I am Rahul" still passes; a false reject costs one retry.
const NOT_A_NAME =
  /^(?:(?:hi+|he+y+|hei+|hel+o+|hlo+|hai+|aloha|hola|namaste|namaskar|salaam|good|morning|afternoon|evening|ok+|okay|yes|no|sir|ma+m|madam|there|thanks|thank|you|please|pls|info|details|price|start|interested)(?: |$))+$/i;

/** Replies like "Hei" or "Good morning" pass the letters-only check, but they aren't names. */
export const isNotAName = (text: string) => NOT_A_NAME.test(text);

type Reply = { text?: string; replyId?: string };

/** Lowercased typed text or tapped id, for matching replies. */
export const replyOf = (msg: Reply) => (msg.replyId ?? msg.text ?? '').trim().toLowerCase();

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);

/**
 * The list option a reply picks: the tapped row, the exact name, its position ("2"), or the one
 * option sharing a word with the text ("evening batch" → "Evening Mon–Fri"). Ambiguous → none.
 */
// ponytail: word overlap, not fuzzy matching. A typo misses and costs one re-ask; the confirm step catches a wrong pick.
export function pickOption<T extends { id: string; name: string }>(
  items: readonly T[],
  msg: Reply,
): T | undefined {
  const reply = replyOf(msg);
  const exact = items.find((i) => i.id === msg.replyId || i.name.toLowerCase() === reply);
  if (exact || msg.replyId) return exact; // a tap on an old list only matches its own row
  if (/^\d{1,2}$/.test(reply)) return items[Number(reply) - 1];
  const said = new Set(words(reply));
  const hits = items.filter((i) => words(i.name).some((w) => said.has(w)));
  return hits.length === 1 ? hits[0] : undefined;
}
