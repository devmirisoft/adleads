// Builds a Meta-shaped inbound webhook payload — what WhatsApp would POST when a lead writes.
// Used by the /dev/whatsapp simulator and tests. Client-safe (no server imports).

export type SimulatedInbound =
  | { kind: 'text'; text: string }
  | { kind: 'button'; id: string; title: string }
  | { kind: 'list'; id: string; title: string }
  /** Tap on a template quick-reply button. */
  | { kind: 'template_button'; id: string; title: string };

export function buildMetaPayload({
  waId,
  profileName,
  message,
  referral,
  messageId = `wamid.sim.${crypto.randomUUID()}`,
  at = new Date(),
}: {
  waId: string;
  profileName: string;
  message: SimulatedInbound;
  referral?: { adId: string; headline: string; ctwaClid: string };
  messageId?: string;
  at?: Date;
}) {
  const content =
    message.kind === 'text'
      ? { type: 'text', text: { body: message.text } }
      : message.kind === 'template_button'
        ? { type: 'button', button: { payload: message.id, text: message.title } }
        : {
            type: 'interactive',
            interactive:
              message.kind === 'button'
                ? { type: 'button_reply', button_reply: { id: message.id, title: message.title } }
                : { type: 'list_reply', list_reply: { id: message.id, title: message.title } },
          };

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000000',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919000000000',
                phone_number_id: '110000000000000',
              },
              contacts: [{ profile: { name: profileName }, wa_id: waId }],
              messages: [
                {
                  from: waId,
                  id: messageId,
                  timestamp: String(Math.floor(at.getTime() / 1000)),
                  ...content,
                  ...(referral && {
                    referral: {
                      source_url: 'https://fb.me/sim',
                      source_id: referral.adId,
                      source_type: 'ad',
                      headline: referral.headline,
                      body: 'Live online classes — book a free trial',
                      media_type: 'image',
                      ctwa_clid: referral.ctwaClid,
                    },
                  }),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
