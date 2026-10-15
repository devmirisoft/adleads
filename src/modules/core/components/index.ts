// The UI kit. Everything outside core imports UI from here — never from ./ui directly.

// shadcn/ui primitives
export * from './ui/alert-dialog';
export * from './ui/avatar';
export * from './ui/badge';
export * from './ui/button';
export * from './ui/calendar';
export * from './ui/card';
export * from './ui/checkbox';
export * from './ui/dialog';
export * from './ui/dropdown-menu';
export * from './ui/input';
export * from './ui/label';
export * from './ui/popover';
export * from './ui/select';
export * from './ui/separator';
export * from './ui/sheet';
export * from './ui/skeleton';
export * from './ui/sonner';
export * from './ui/switch';
export * from './ui/table';
export * from './ui/tabs';
export * from './ui/textarea';
export * from './ui/tooltip';
export { toast } from 'sonner';

// App components
export { AdminShell } from './AdminShell';
export type { ShellUser } from './Sidebar';
export { ConfirmDialog } from './ConfirmDialog';
export { DataTable, type DataTableColumn } from './DataTable';
export { DateTime } from './DateTime';
export { EmptyState } from './EmptyState';
export { FilterBar, FilterDateRange, FilterSelect, FilterToggle } from './FilterBar';
export { FormField } from './FormField';
export { KeyValueList } from './KeyValueList';
export { Money } from './Money';
export { PageHeader } from './PageHeader';
export { Phone } from './Phone';
export { SectionCard } from './SectionCard';
export { StatTile } from './StatTile';
export { StatusBadge, STATUSES, statusLabel, type Status } from './StatusBadge';
