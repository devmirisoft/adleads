// Public API of this module — import from '@/modules/messaging' only.
export type * from './types';
export {
  OutsideWindowError,
  sendButtons,
  sendList,
  sendTemplate,
  sendText,
  type SendOptions,
} from './services/send';
export { applyStatus, hasMessage, listMessages, recordInbound } from './services/inbound';
export { isWindowOpen } from './services/window';
export { metaEventKey, parseMetaWebhook } from './services/parseWebhook';
export {
  TEMPLATE_NAMES,
  TEMPLATES,
  type TemplateName,
  type TemplateVars,
} from './constants/templates';
export { buildMetaPayload, type SimulatedInbound } from './utils/metaPayload';
export { sendReply, sendTemplateReply } from './services/actions';
export { ChatBubble } from './components/ChatBubble';
export { ChatThread } from './components/ChatThread';
export { ReplyBox, type TemplateOption } from './components/ReplyBox';
export { WhatsAppSimulator } from './components/WhatsAppSimulator';
