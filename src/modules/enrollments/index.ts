// Public API of this module — import from '@/modules/enrollments' only.
export { assignSeat, moveBatch, reclaimSeat, type AssignResult } from './services/assignSeat';
export {
  cancelRegistrant,
  ensureRegistered,
  firstName,
  sendTrialLink,
} from './services/sendTrialLink';
export { cancel } from './services/cancel';
export { expire } from './services/expire';
export { extendTrial, sendClassReminders } from './services/trial';
export {
  listEnrollments,
  listOpenBatches,
  todayIst,
  type EnrollmentListItem,
} from './services/queries';
export {
  assignBatchAction,
  cancelEnrollmentAction,
  extendTrialAction,
  moveBatchAction,
  resendTrialLinkAction,
} from './services/actions';
export { enrollmentFiltersSchema, type BatchOption, type EnrollmentFilters } from './types';
export { AssignBatchDialog } from './components/AssignBatchDialog';
export { EnrollmentActions, type EnrollmentRef } from './components/EnrollmentActions';
export { EnrollmentFilterBar, EnrollmentTable } from './components/EnrollmentTable';
