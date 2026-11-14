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
import {
  BOT_MESSAGE_KEYS,
  BOT_MESSAGES,
  botMessageSchema,
  fillMessage,
  type BotMessageInput,
  type BotMessageKey,
} from '../constants/messages';

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

const storedText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

/** A bot reply ready to send: the staff-edited text (else the default) with placeholders filled. */
export async function getMessage(key: BotMessageKey, vars?: Record<string, string>) {
  const row = await db.setting.findUnique({ where: { key } });
  return fillMessage(storedText(row?.value) ?? BOT_MESSAGES[key].default, vars);
}

/** Every bot reply as stored (placeholders unfilled), for the Bot script page. */
export async function getBotMessages(): Promise<Record<BotMessageKey, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: BOT_MESSAGE_KEYS } } });
  const stored = new Map(rows.map((r) => [r.key, storedText(r.value)]));
  return Object.fromEntries(
    BOT_MESSAGE_KEYS.map((k) => [k, stored.get(k) ?? BOT_MESSAGES[k].default]),
  ) as Record<BotMessageKey, string>;
}

export async function saveBotMessage(input: BotMessageInput) {
  const { key, text } = botMessageSchema.parse(input);
  await db.setting.upsert({ where: { key }, create: { key, value: text }, update: { value: text } });
}
