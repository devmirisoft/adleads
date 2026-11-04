export type InboundMessage = {
  waId: string;
  /** E.164 */
  phone: string;
  profileName?: string;
  messageId: string;
  timestamp: Date;
  /** button = interactive button_reply or a template quick-reply; list = list_reply */
  kind: 'text' | 'button' | 'list' | 'other';
  /** Typed text, or the tapped button/row title. */
  text?: string;
  /** Tapped button/row id (or template quick-reply payload). */
  replyId?: string;
  referral?: { adId: string; ctwaClid?: string; headline?: string };
};

export type StatusUpdate = {
  waMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorCode?: string;
};

export type ChatButton = { id: string; title: string };
export type ChatRow = { id: string; title: string; description?: string };

/** What's stored in messages.body — enough to render the message in a chat thread. */
export type MessageBody = {
  text?: string;
  /** Inbound tap: the button/row id. */
  replyId?: string;
  /** Outbound reply buttons (interactive or template quick replies). */
  buttons?: ChatButton[];
  /** Outbound list: label of the button that opens it + its rows. */
  button?: string;
  rows?: ChatRow[];
  /** Templates */
  name?: string;
  language?: string;
  params?: string[];
  /** Bot bookkeeping: this message re-asked step N after an invalid answer. */
  retryStep?: number;
  /** Staff thread: the browser's id for its optimistic bubble, so the saved row can replace it. */
  clientId?: string;
};

/** A Message row as sent to the browser. */
export type ChatMessage = {
  id: string;
  direction: 'IN' | 'OUT';
  type: 'TEXT' | 'INTERACTIVE' | 'TEMPLATE' | 'MEDIA';
  templateName: string | null;
  body: MessageBody;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorCode: string | null;
  sentBy: string;
  createdAt: string;
  /** Moves on every status change, so polling can find it and a late reply can't undo it. */
};

/** One page of a thread (oldest first). Pass `cursor` as `?after=` to get what changed since. */
export type ChatPage = {
  messages: ChatMessage[];
  /** Older messages exist: fetch them with `?before=<oldest id>`. */
  hasMore: boolean;
  cursor: string;
};

/** Pushed on a lead's channel. `refetch`: the row was too big to push, so fetch it. */
export type ChatEvent =
  { message: ChatMessage; refetch?: never } | { refetch: true; message?: never };
