/**
 * Odatlar va reja seriyalari — sof mantiq (testlanadi).
 *
 * Belgilar xaritasi: `${habitId}:${day}` → true (bajarildi / tiyildi) yoki
 * false (bajarilmadi / tiyilmadi). Kalit yoʻq = belgilanmagan.
 */

import type { BlockId } from './blocks';
import { addDays } from './time';

export type HabitKind = 'do' | 'avoid';

export interface Habit {
  id: number;
  title: string;
  kind: HabitKind;
  /** 7 = har kuni; 1–6 = haftada shuncha marta */
  targetPerWeek: number;
  block: BlockId | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

export type HabitMarks = ReadonlyMap<string, boolean>;

export function markKey(habitId: number, day: string): string {
  return `${habitId}:${day}`;
}

export function isDaily(h: Pick<Habit, 'targetPerWeek'>): boolean {
  return h.targetPerWeek >= 7;
}

/**
 * Ketma-ket bajarilgan kunlar. Bugun hali belgilanmagan boʻlsa seriya uzilmaydi —
 * kechagidan sanaladi (kun hali tugamagan).
 */
export function streak(habitId: number, marks: HabitMarks, today: string, maxDays = 366): number {
  let day = marks.get(markKey(habitId, today)) === true ? today : addDays(today, -1);
  let n = 0;
  while (n < maxDays && marks.get(markKey(habitId, day)) === true) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Hafta (dushanbadan bugungacha) natijasi */
export function weekProgress(
  habitId: number,
  marks: HabitMarks,
  weekStartDay: string,
  today: string,
): { done: number; failed: number } {
  let done = 0;
  let failed = 0;
  for (let d = weekStartDay; d <= today; d = addDays(d, 1)) {
    const m = marks.get(markKey(habitId, d));
    if (m === true) done++;
    else if (m === false) failed++;
  }
  return { done, failed };
}

/** Odat qatoridagi qisqa izoh: "🔥 5 kun" yoki "bu hafta 1/3" */
export function habitMeta(h: Habit, marks: HabitMarks, weekStartDay: string, today: string): string {
  if (!isDaily(h)) {
    const w = weekProgress(h.id, marks, weekStartDay, today);
    return `bu hafta ${w.done}/${h.targetPerWeek}`;
  }
  const s = streak(h.id, marks, today);
  return s > 0 ? `${s} kun ketma-ket` : h.kind === 'avoid' ? 'bugundan boshlang' : 'yangi boshlanish';
}

/**
 * Reja tuzish seriyasi. `plannedDays` — kechqurun reja tuzilgan (ertangi) kunlar.
 * Bugun kechqurun ertangi kun rejalangan boʻlsa, seriya ertangi kundan sanaladi.
 */
export function planningStreak(plannedDays: ReadonlySet<string>, today: string): number {
  let day = plannedDays.has(addDays(today, 1)) ? addDays(today, 1) : today;
  let n = 0;
  while (plannedDays.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Hozir yotilsa, ertangi Bomdodgacha necha soat uyqu (0,5 ga yaxlitlab) */
export function sleepHoursUntil(now: Date, wake: Date): number {
  const h = (wake.getTime() - now.getTime()) / 3_600_000;
  return Math.max(0, Math.round(h * 2) / 2);
}
