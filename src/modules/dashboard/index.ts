// Public API of this module — import from '@/modules/dashboard' only. Read-only reports.
export {
  getBatchPreference,
  getCourseBreakdown,
  getFunnel,
  getLeadsByAd,
  getStats,
  resolveRange,
  type AdRow,
  type CourseRow,
  type Range,
} from './services/reports';
export { CourseBreakdownTable, type StageColumn } from './components/CourseBreakdownTable';
export { FunnelCard } from './components/FunnelCard';
export { LeadsByAdTable } from './components/LeadsByAdTable';
