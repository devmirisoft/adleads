// Public API of this module — import from '@/modules/dashboard' only. Read-only reports.
export {
  getFunnel,
  getLeadsByAd,
  getStats,
  resolveRange,
  type AdRow,
  type Range,
} from './services/reports';
export { FunnelCard } from './components/FunnelCard';
export { LeadsByAdTable } from './components/LeadsByAdTable';
