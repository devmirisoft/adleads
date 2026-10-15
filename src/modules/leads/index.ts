// Public API of this module — import from '@/modules/leads' only.
export { transition, IllegalTransitionError, type Actor } from './services/transition';
export { upsertLead, type InboundSender } from './services/upsertLead';
export {
  countInbox,
  exportLeadsCsv,
  findLeadIdByPhone,
  getLeadDetail,
  listInbox,
  listLeads,
  type LeadDetail,
  type LeadListItem,
} from './services/queries';
export { assignLeads, changeStatus, resolveLead, updateNotes } from './services/actions';
export {
  canTransition,
  LEAD_STATUS,
  LEAD_TRANSITIONS,
  MANUAL_STATUS_TARGETS,
  SOURCE_LABEL,
  type LeadStatus,
} from './constants/statuses';
export { leadFiltersSchema, type LeadFilters } from './types';
export { InboxTable } from './components/InboxTable';
export { LeadExportButton } from './components/LeadExportButton';
export { LeadFilters as LeadFilterBar } from './components/LeadFilters';
export { LeadsTable } from './components/LeadsTable';
export { leadName } from './utils';
export { LeadStatusControl } from './components/LeadStatusControl';
export { LeadTimeline } from './components/LeadTimeline';
export { NotesForm } from './components/NotesForm';
export { ResolveButton } from './components/ResolveButton';
