// WhatsApp adapter contract + Cloud API limits. Both fake and live enforce the limits,
// so a message that passes locally won't be rejected by Meta later.

export type SendResult = { waMessageId: string };

export type Button = { id: string; title: string };
export type ListRow = { id: string; title: string; description?: string };

export interface WhatsAppClient {
  sendText(to: string, text: string): Promise<SendResult>;
  /** 1–3 reply buttons. */
  sendButtons(to: string, msg: { body: string; buttons: Button[] }): Promise<SendResult>;
  /** Single-section list; `button` is the label that opens it. */
  sendList(to: string, msg: { body: string; button: string; rows: ListRow[] }): Promise<SendResult>;
  /** Body params only, in order ({{1}}, {{2}}, …). */
  sendTemplate(to: string, name: string, lang: string, params: string[]): Promise<SendResult>;
}

export const LIMITS = {
  textBody: 4096,
  interactiveBody: 1024,
  buttons: 3,
  buttonTitle: 20,
  buttonId: 256,
  listButton: 20,
  listRows: 10,
  rowTitle: 24,
  rowDescription: 72,
  rowId: 200,
} as const;

export class WhatsAppLimitError extends Error {
  name = 'WhatsAppLimitError';
}

function check(ok: boolean, message: string) {
  if (!ok) throw new WhatsAppLimitError(message);
}

const within = (s: string, max: number) => s.length > 0 && s.length <= max;
const unique = (xs: string[]) => new Set(xs).size === xs.length;

export function checkText(text: string) {
  check(within(text, LIMITS.textBody), `Text must be 1–${LIMITS.textBody} characters`);
}

export function checkButtons({ body, buttons }: { body: string; buttons: Button[] }) {
  check(
    within(body, LIMITS.interactiveBody),
    `Body must be 1–${LIMITS.interactiveBody} characters`,
  );
  check(
    buttons.length >= 1 && buttons.length <= LIMITS.buttons,
    `1–${LIMITS.buttons} buttons allowed`,
  );
  for (const b of buttons) {
    check(
      within(b.title, LIMITS.buttonTitle),
      `Button "${b.title}" title must be 1–${LIMITS.buttonTitle} characters`,
    );
    check(
      within(b.id, LIMITS.buttonId),
      `Button "${b.title}" id must be 1–${LIMITS.buttonId} characters`,
    );
  }
  check(unique(buttons.map((b) => b.id)), 'Button ids must be unique');
  check(unique(buttons.map((b) => b.title)), 'Button titles must be unique');
}

export function checkList({
  body,
  button,
  rows,
}: {
  body: string;
  button: string;
  rows: ListRow[];
}) {
  check(
    within(body, LIMITS.interactiveBody),
    `Body must be 1–${LIMITS.interactiveBody} characters`,
  );
  check(within(button, LIMITS.listButton), `List button must be 1–${LIMITS.listButton} characters`);
  check(
    rows.length >= 1 && rows.length <= LIMITS.listRows,
    `1–${LIMITS.listRows} list rows allowed`,
  );
  for (const r of rows) {
    check(
      within(r.title, LIMITS.rowTitle),
      `Row "${r.title}" title must be 1–${LIMITS.rowTitle} characters`,
    );
    check(within(r.id, LIMITS.rowId), `Row "${r.title}" id must be 1–${LIMITS.rowId} characters`);
    check(
      r.description === undefined || r.description.length <= LIMITS.rowDescription,
      `Row "${r.title}" description must be at most ${LIMITS.rowDescription} characters`,
    );
  }
  check(unique(rows.map((r) => r.id)), 'Row ids must be unique');
}

export function checkTemplate(name: string, lang: string) {
  check(/^[a-z0-9_]{1,512}$/.test(name), 'Template name must be lowercase letters, digits and _');
  check(/^[a-z]{2,3}(_[A-Z]{2})?$/.test(lang), 'Template language must look like "en" or "en_US"');
}
