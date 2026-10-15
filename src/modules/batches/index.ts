// Public API of this module — import from '@/modules/batches' only. Batches + the course catalog.
export { BatchError, closeBatch, createBatch, updateBatch } from './services/batches';
export { createCourse, deleteCourse, updateCourse } from './services/courses';
export {
  getBatch,
  listAllBatches,
  listBatches,
  listCourses,
  type BatchListItem,
  type CourseListItem,
} from './services/queries';
export {
  closeBatchAction,
  deleteCourseAction,
  saveBatchAction,
  saveCourseAction,
} from './services/actions';
export {
  batchFiltersSchema,
  batchInputSchema,
  courseInputSchema,
  type BatchFilters,
  type BatchInput,
  type CourseInput,
} from './types';
export { AddBatchButton, BatchActions, BatchFilterBar, BatchTable } from './components/BatchTable';
export { CoursesTable } from './components/CoursesTable';
export { SeatMeter } from './components/SeatMeter';
export { batchSchedule } from './utils';
