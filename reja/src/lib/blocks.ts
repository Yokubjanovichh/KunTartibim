/**
 * Kun bloklari — namozlarga tayangan vaqt boʻlaklari.
 *
 * Foydalanuvchining kuni qatʼiy jadvalga ega emas, lekin namozlar har kuni bor.
 * Shuning uchun ish "soat 16:00" emas, "Asrdan keyin" deb rejalanadi: namoz
 * vaqtlari yil davomida siljiganda reja ham ular bilan birga siljiydi.
 */

import type { DayTimes, TimeKey } from './prayer-times';
import { atTime } from './time';

export const BLOCKS = ['morning', 'noon', 'afternoon', 'evening', 'night'] as const;
export type BlockId = (typeof BLOCKS)[number];

export const BLOCK_LABEL: Record<BlockId, string> = {
  morning: 'Bomdoddan keyin',
  noon: 'Peshindan keyin',
  afternoon: 'Asrdan keyin',
  evening: 'Shomdan keyin',
  night: 'Xuftondan keyin',
};

const BLOCK_PRAYER: Record<BlockId, TimeKey> = {
  morning: 'bomdod',
  noon: 'peshin',
  afternoon: 'asr',
  evening: 'shom',
  night: 'xufton',
};

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === 'string' && (BLOCKS as readonly string[]).includes(value);
}

export function blockStart(times: DayTimes, block: BlockId): Date {
  return times[BLOCK_PRAYER[block]];
}

/** Hozir qaysi blok ichidamiz (namoz kuni boʻyicha). Bomdoddan oldin — null. */
export function currentBlock(times: DayTimes, now: Date): BlockId | null {
  const t = now.getTime();
  let found: BlockId | null = null;
  for (const b of BLOCKS) if (t >= blockStart(times, b).getTime()) found = b;
  return found;
}

/**
 * Namoz kunidagi 'HH:MM' → aniq vaqt. Namoz kuni Bomdoddan ertangi Bomdodgacha,
 * shuning uchun Bomdoddan oldingi soatlar (masalan, 01:00) — shu kunning tuni,
 * yaʼni ertasi kalendar sanasi.
 */
export function momentOnPrayerDay(times: DayTimes, day: string, hm: string): Date {
  const d = atTime(day, hm);
  if (d.getTime() < times.bomdod.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Aniq vaqtli ish qaysi blokka tushadi: 14:00 → "Peshindan keyin" */
export function blockForTime(times: DayTimes, day: string, hm: string): BlockId {
  return currentBlock(times, momentOnPrayerDay(times, day, hm)) ?? 'night';
}
