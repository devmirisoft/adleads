import type { ROLES } from '../constants';

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type Role = (typeof ROLES)[number];
/** The two links staff paste per batch: one for trials, one once paid. */
export type LinkKind = 'trial' | 'paid';
