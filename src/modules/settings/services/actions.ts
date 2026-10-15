'use server';
import 'server-only';
import { z } from 'zod';
import { ADMIN_ONLY, guarded } from '@/modules/auth';
import type { NewUser, SettingsForm } from '../constants/keys';
import { updateSettings } from './settings';
import { createUser, setUserActive, setUserRole } from './users';

const id = z.uuid();
const role = z.enum(['ADMIN', 'SALES', 'VIEWER']);

export async function saveSettingsAction(input: SettingsForm) {
  return guarded(ADMIN_ONLY, async () => {
    await updateSettings(input);
    return null;
  });
}

export async function addUserAction(input: NewUser) {
  return guarded(ADMIN_ONLY, async () => (await createUser(input)).id);
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  return guarded(ADMIN_ONLY, async (me) => {
    await setUserActive(id.parse(userId), z.boolean().parse(isActive), me.id);
    return null;
  });
}

export async function setUserRoleAction(userId: string, newRole: 'ADMIN' | 'SALES' | 'VIEWER') {
  return guarded(ADMIN_ONLY, async (me) => {
    await setUserRole(id.parse(userId), role.parse(newRole), me.id);
    return null;
  });
}
