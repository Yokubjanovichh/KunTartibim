/**
 * Ishlar va rejalarni «Kun tartibim» ilovasiga koʻchirish.
 *
 * Ilova ikkiga boʻlindi (2026-10-10): namoz va qazo — shu yerda (Namozim), kunlik
 * reja — «Kun tartibim»da (`reja/`). Eski ishlar, odatlar, kechki rejalar va
 * xulosalar shu bazada qolgan; ular havola ichida yuboriladi:
 * `kunreja://import?d=<JSON>` — fayl tanlash, ulashish kerak emas, bitta bosish.
 * «Kun tartibim» qayta yuborilganini aniqlaydi va takrorlamaydi.
 *
 * ⚠️ Format `reja/src/lib/transfer.ts` (TransferPayload) bilan bir xil boʻlishi shart.
 */

import { getDb, getSetting, setSetting } from '../db/client';
import { emitChange } from './events';

export const PLANNER_SCHEME = 'kunreja';
const MOVED_KEY = 'planner_moved_at';

export interface PlannerPayload {
  v: 1;
  exportedAt: string;
  tasks: {
    title: string;
    day: string | null;
    block: string | null;
    time: string | null;
    remindBefore: number | null;
    priority: number;
    status: string;
    doneAt: string | null;
    movedCount: number;
    createdAt: string;
  }[];
  habits: {
    id: number;
    title: string;
    kind: string;
    targetPerWeek: number;
    block: string | null;
    sortOrder: number;
    archived: number;
    createdAt: string;
  }[];
  habitLog: { habitId: number; day: string; done: number; at: string }[];
  dayPlans: { day: string; plannedAt: string }[];
  notes: { day: string; text: string; updatedAt: string }[];
  settings: {
    adjustments?: Record<string, number>;
    reviewTime?: string;
    bedtimeEnabled?: boolean;
    bedtime?: string;
  };
}

export function buildPlannerPayload(now = new Date()): PlannerPayload {
  const db = getDb();
  const settings: PlannerPayload['settings'] = {};
  try {
    const adj = JSON.parse(getSetting('adjustments') ?? 'null') as unknown;
    if (adj && typeof adj === 'object') settings.adjustments = adj as Record<string, number>;
  } catch {
    // tuzatishlarsiz
  }
  // Faqat foydalanuvchi oʻzgartirganlari — boʻlmasa «Kun tartibim» oʻz sukutini oladi
  const review = getSetting('review_time');
  if (review) settings.reviewTime = review;
  const bedtime = getSetting('bedtime');
  if (bedtime) settings.bedtime = bedtime;
  const bedtimeOn = getSetting('bedtime_enabled');
  if (bedtimeOn !== null) settings.bedtimeEnabled = bedtimeOn === '1';

  return {
    v: 1,
    exportedAt: now.toISOString(),
    tasks: db.getAllSync(
      `SELECT title, day, block, time, remind_before AS remindBefore, priority, status, done_at AS doneAt,
              moved_count AS movedCount, created_at AS createdAt
         FROM tasks ORDER BY id;`,
    ),
    habits: db.getAllSync(
      `SELECT id, title, kind, target_per_week AS targetPerWeek, block, sort_order AS sortOrder, archived,
              created_at AS createdAt
         FROM habits ORDER BY id;`,
    ),
    habitLog: db.getAllSync('SELECT habit_id AS habitId, day, done, at FROM habit_log ORDER BY day;'),
    dayPlans: db.getAllSync('SELECT day, planned_at AS plannedAt FROM day_plans ORDER BY day;'),
    notes: db.getAllSync('SELECT day, text, updated_at AS updatedAt FROM day_notes ORDER BY day;'),
    settings,
  };
}

/** Koʻchiriladigan yozuvlar soni: ishlar, odatlar, kechki rejalar, xulosalar */
export function plannerDataCount(): number {
  return (
    getDb().getFirstSync<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM habits)
            + (SELECT COUNT(*) FROM day_plans) + (SELECT COUNT(*) FROM day_notes) AS n;`,
    )?.n ?? 0
  );
}

/** Oxirgi marta qachon yuborilgan (ilova ochilgan) */
export function plannerMovedAt(): Date | null {
  const v = getSetting(MOVED_KEY);
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null;
}

export function plannerImportUrl(payload: PlannerPayload = buildPlannerPayload()): string {
  return `${PLANNER_SCHEME}://import?d=${encodeURIComponent(JSON.stringify(payload))}`;
}

/** Havola ochildi — Bugun ekranidagi eslatma endi koʻrinmaydi (Sozlamalarda qayta yuborish mumkin) */
export function markPlannerMoved(now = new Date()): void {
  setSetting(MOVED_KEY, now.toISOString());
  emitChange();
}
