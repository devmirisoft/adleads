// Public API of this module — import from '@/modules/auth' only. Any module may use it (like core).
export { LoginForm } from './components/LoginForm';
export { login, signOutAction } from './services/actions';
export { requireRole, requireUser } from './services/requireRole';
export { ADMIN_ONLY, CAN_ACT, guarded } from './services/guarded';
export { loginSchema, type LoginInput, type SessionUser } from './types';
