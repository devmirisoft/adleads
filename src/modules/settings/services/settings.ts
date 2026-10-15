import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { db, type Tx } from '@/lib/db';
import {
  SETTINGS,
  settingsFormSchema,
  type AllSettings,
  type SettingKey,
  type SettingsForm,
  type SettingValue,
} from '../constants/keys';

/** Typed setting; falls back to the default if the row is missing or holds a bad value. */
export async function getSetting<K extends SettingKey>(
  key: K,
  tx: Tx = db,
): Promise<SettingValue<K>> {
  const row = await tx.setting.findUnique({ where: { key } });
  const parsed = SETTINGS[key].schema.safeParse(row?.value);
  return (parsed.success ? parsed.data : SETTINGS[key].default) as SettingValue<K>;
}

export async function getAllSettings(): Promise<AllSettings> {
  const keys = Object.keys(SETTINGS) as SettingKey[];
  const values = await Promise.all(keys.map((k) => getSetting(k)));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as AllSettings;
}

export async function updateSettings(input: SettingsForm) {
  const { first_nudge_hours, second_nudge_hours, ...rest } = settingsFormSchema.parse(input);
  const values: Record<SettingKey, Prisma.InputJsonValue> = {
    ...rest,
    nudge_after_hours: [first_nudge_hours, second_nudge_hours],
  };
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
}
