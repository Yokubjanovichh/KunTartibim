/**
 * Namozimdan koʻchirish — ikki ilova boʻlinganda eski ishlar, odatlar, rejalar
 * va xulosalar shu yerga oʻtadi.
 *
 * Namozim maʼlumotni havola ichida yuboradi: `kunreja://import?d=<JSON>` —
 * fayl tanlash, ulashish kerak emas, bitta bosish. Bu yerda u tekshiriladi va
 * bitta tranzaksiyada yoziladi. Qayta koʻchirilsa takrorlanmaydi: ish va odat
 * (nomi + yaratilgan vaqti) boʻyicha, qolganlari kalit boʻyicha aniqlanadi.
 *
 * ⚠️ Format Namozimdagi `src/lib/planner-export.ts` bilan bir xil boʻlishi shart.
 */

import { getDb, getSetting, setSetting } from '../db/client';
import { isBlockId } from './blocks';
import { emitChange } from './events';
import { TIME_KEYS } from './prayer-times';
import { parseHm } from './time';

export interface TransferTask {
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
}

export interface TransferHabit {
  id: number;
  title: string;
  kind: string;
  targetPerWeek: number;
  block: string | null;
  sortOrder: number;
  archived: number;
  createdAt: string;
}

export interface TransferPayload {
  v: 1;
  exportedAt: string;
  tasks: TransferTask[];
  habits: TransferHabit[];
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

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_KEY_RE = /^(week:)?\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const int = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback);
const iso = (v: unknown, fallback: string): string => {
  const s = str(v);
  return s && !Number.isNaN(Date.parse(s)) ? s : fallback;
};
const day = (v: unknown): string | null => {
  const s = str(v);
  return s && DAY_RE.test(s) ? s : null;
};
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

export type ParseResult = { ok: true; payload: TransferPayload } | { ok: false; error: string };

/** Havoladagi matnni tekshiradi va tozalaydi — buzuq yozuvlar tashlab yuboriladi */
export function parseTransfer(raw: string | undefined | null): ParseResult {
  if (!raw) return { ok: false, error: 'Havolada maʼlumot yoʻq' };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'Maʼlumot buzilgan (JSON oʻqilmadi)' };
  }
  if (!data || typeof data !== 'object' || data.v !== 1) return { ok: false, error: 'Nomaʼlum format — Namozim ilovasini yangilang' };
  const now = new Date().toISOString();

  const tasks: TransferTask[] = list(data.tasks).flatMap((t) => {
    const title = str(t.title)?.trim();
    if (!title) return [];
    const d = day(t.day);
    const rawTime = str(t.time);
    const time = d && rawTime && parseHm(rawTime) !== null ? rawTime : null;
    const remind = t.remindBefore === null || t.remindBefore === undefined ? null : int(t.remindBefore, -1);
    const status = t.status === 'done' || t.status === 'dropped' ? t.status : 'open';
    return [
      {
        title,
        day: d,
        block: isBlockId(t.block) ? t.block : null,
        time,
        remindBefore: time && remind !== null && remind >= 0 ? remind : null,
        priority: d && int(t.priority, 0) === 1 ? 1 : 0,
        status,
        doneAt: status === 'done' ? iso(t.doneAt, now) : null,
        movedCount: Math.max(0, int(t.movedCount, 0)),
        createdAt: iso(t.createdAt, now),
      },
    ];
  });

  const habits: TransferHabit[] = list(data.habits).flatMap((h) => {
    const title = str(h.title)?.trim();
    const id = int(h.id, NaN);
    if (!title || !Number.isFinite(id)) return [];
    return [
      {
        id,
        title,
        kind: h.kind === 'avoid' ? 'avoid' : 'do',
        targetPerWeek: Math.min(7, Math.max(1, int(h.targetPerWeek, 7))),
        block: isBlockId(h.block) ? h.block : null,
        sortOrder: int(h.sortOrder, 0),
        archived: int(h.archived, 0) === 1 ? 1 : 0,
        createdAt: iso(h.createdAt, now),
      },
    ];
  });

  const habitLog = list(data.habitLog).flatMap((l) => {
    const d = day(l.day);
    const habitId = int(l.habitId, NaN);
    if (!d || !Number.isFinite(habitId)) return [];
    return [{ habitId, day: d, done: int(l.done, 0) === 1 ? 1 : 0, at: iso(l.at, now) }];
  });

  const dayPlans = list(data.dayPlans).flatMap((p) => {
    const d = day(p.day);
    return d ? [{ day: d, plannedAt: iso(p.plannedAt, now) }] : [];
  });

  const notes = list(data.notes).flatMap((n) => {
    const key = str(n.day);
    const text = str(n.text)?.trim();
    return key && NOTE_KEY_RE.test(key) && text ? [{ day: key, text, updatedAt: iso(n.updatedAt, now) }] : [];
  });

  const s = data.settings && typeof data.settings === 'object' ? (data.settings as Record<string, unknown>) : {};
  const settings: TransferPayload['settings'] = {};
  if (s.adjustments && typeof s.adjustments === 'object') {
    const adj: Record<string, number> = {};
    for (const k of TIME_KEYS) {
      const n = (s.adjustments as Record<string, unknown>)[k];
      if (typeof n === 'number' && Number.isFinite(n)) adj[k] = Math.max(-30, Math.min(30, Math.round(n)));
    }
    settings.adjustments = adj;
  }
  const review = str(s.reviewTime);
  if (review && parseHm(review) !== null) settings.reviewTime = review;
  const bedtime = str(s.bedtime);
  if (bedtime && parseHm(bedtime) !== null) settings.bedtime = bedtime;
  if (typeof s.bedtimeEnabled === 'boolean') settings.bedtimeEnabled = s.bedtimeEnabled;

  return { ok: true, payload: { v: 1, exportedAt: iso(data.exportedAt, now), tasks, habits, habitLog, dayPlans, notes, settings } };
}

export interface TransferResult {
  tasks: number;
  habits: number;
  notes: number;
  /** Allaqachon bor boʻlgani uchun oʻtkazib yuborilgan ishlar */
  skipped: number;
}

/** Bitta tranzaksiyada yozadi. Qayta chaqirilsa — mavjudlari takrorlanmaydi. */
export function applyTransfer(p: TransferPayload): TransferResult {
  const db = getDb();
  const result: TransferResult = { tasks: 0, habits: 0, notes: 0, skipped: 0 };
  const firstImport = getSetting('imported_at') === null;

  db.withTransactionSync(() => {
    // Odatlar: eski id → yangi id (belgilar shu boʻyicha bogʻlanadi)
    const habitIds = new Map<number, number>();
    for (const h of p.habits) {
      const existing = db.getFirstSync<{ id: number }>('SELECT id FROM habits WHERE title = ? AND created_at = ?;', [
        h.title,
        h.createdAt,
      ]);
      if (existing) {
        habitIds.set(h.id, existing.id);
        continue;
      }
      const res = db.runSync(
        'INSERT INTO habits (title, kind, target_per_week, block, sort_order, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [h.title, h.kind, h.targetPerWeek, h.block, h.sortOrder, h.archived, h.createdAt],
      );
      habitIds.set(h.id, Number(res.lastInsertRowId));
      result.habits++;
    }
    for (const l of p.habitLog) {
      const id = habitIds.get(l.habitId);
      if (id === undefined) continue;
      db.runSync('INSERT OR IGNORE INTO habit_log (habit_id, day, done, at) VALUES (?, ?, ?, ?);', [id, l.day, l.done, l.at]);
    }

    for (const t of p.tasks) {
      const dup = db.getFirstSync<{ id: number }>('SELECT id FROM tasks WHERE title = ? AND created_at = ?;', [t.title, t.createdAt]);
      if (dup) {
        result.skipped++;
        continue;
      }
      db.runSync(
        `INSERT INTO tasks (title, day, block, time, remind_before, priority, status, done_at, moved_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [t.title, t.day, t.block, t.time, t.remindBefore, t.priority, t.status, t.doneAt, t.movedCount, t.createdAt],
      );
      result.tasks++;
    }

    for (const d of p.dayPlans) {
      db.runSync('INSERT OR IGNORE INTO day_plans (day, planned_at) VALUES (?, ?);', [d.day, d.plannedAt]);
    }
    // Bu ilovada yozilgan xulosa ustiga yozilmaydi
    for (const n of p.notes) {
      const res = db.runSync('INSERT OR IGNORE INTO day_notes (day, text, updated_at) VALUES (?, ?, ?);', [n.day, n.text, n.updatedAt]);
      result.notes += res.changes;
    }

    // Namoz vaqtlari tuzatishlari doim Namozimnikiga teng boʻlsin — boʻlaklar bir xil siljisin.
    // Eslatma vaqtlari esa faqat birinchi koʻchirishda: keyin bu yerdagi sozlama ustun.
    if (p.settings.adjustments && Object.keys(p.settings.adjustments).length) {
      setSetting('adjustments', JSON.stringify(p.settings.adjustments));
    }
    if (firstImport) {
      if (p.settings.reviewTime) setSetting('review_time', p.settings.reviewTime);
      if (p.settings.bedtime) setSetting('bedtime', p.settings.bedtime);
      if (p.settings.bedtimeEnabled !== undefined) setSetting('bedtime_enabled', p.settings.bedtimeEnabled ? '1' : '0');
    }
    setSetting('imported_at', new Date().toISOString());
  });

  emitChange();
  return result;
}

export function transferSummary(p: TransferPayload): string {
  const open = p.tasks.filter((t) => t.status === 'open').length;
  const parts = [
    p.tasks.length ? `${p.tasks.length} ta ish${open ? ` (${open} tasi ochiq)` : ''}` : null,
    p.habits.length ? `${p.habits.length} ta odat` : null,
    p.notes.length ? `${p.notes.length} ta xulosa` : null,
    p.dayPlans.length ? `${p.dayPlans.length} kunlik reja belgisi` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Koʻchiradigan ish yoʻq — faqat sozlamalar';
}
