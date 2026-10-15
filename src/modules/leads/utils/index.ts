/** Display name: the name they gave the bot, else their WhatsApp profile name. */
export const leadName = (l: { name: string | null; profileName: string | null }) =>
  l.name ?? l.profileName ?? 'Unnamed lead';
