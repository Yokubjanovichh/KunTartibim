/**
 * Eslatmalar rejasi — sof mantiq (testlanadi).
 * -------------------------------------------
 * Bu modul faqat "qaysi bildirishnoma qachon chiqishi kerak" degan roʻyxatni
 * tuzadi. Telefonga qoʻyish `notifications.ts` ning ishi: u mavjudlari bilan
 * solishtirib, faqat oʻzgarganlarini qayta qoʻyadi.
 *
 *   morning — "Bugungi reja": Bomdoddan 30 daqiqa keyin (namoz oʻqib boʻlingach) —
 *             asosiy ishlar va kunning qolgan ishlari
 *   block   — kun boʻlagi boshlanganda (namozdan 20 daqiqa keyin) shu boʻlakdagi ishlar
 *   task    — aniq vaqtli ish + [Bajarildi ✓]
 *   review  — kun yakuni va ertangi reja (Tahlil)
 *   sleep   — yotish vaqti: ertangi Bomdodgacha necha soat uyqu qoladi
 *
 * Namoz eslatmalari bu yerda yoʻq — ular Namozim ilovasida. Bajarilgan ishlar
 * rejaga kirmaydi — sinxronlash ularning eslatmalarini bekor qiladi.
 */

import { BLOCK_LABEL, BLOCKS, type BlockId, blockStart, momentOnPrayerDay } from './blocks';
import { sleepHoursUntil } from './habits';
import type { PrayerCalendar } from './prayer-times';
import { addDays, addMinutes, eveningAt, hhmm } from './time';

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export type NotificationKind = 'morning' | 'block' | 'review' | 'sleep' | 'task' | 'snooze' | 'test' | 'unknown';

/**
 * Bildirishnoma tugmalari toʻplamlari.
 *   task — [Bajarildi ✓] [15 daqiqadan keyin]
 *   info — tugmasiz
 */
export type CategoryId = 'task' | 'info';

export interface NotificationData {
  kind: NotificationKind;
  day?: string;
  block?: BlockId;
  /** Vaqtli ish eslatmasi uchun */
  taskId?: number;
  /** Bosilganda ochiladigan ekran */
  route?: string;
  /** Kontent xeshi — sinxronlashda oʻzgarganini aniqlash uchun */
  h?: string;
}

export interface PlannedNotification {
  id: string;
  at: Date;
  title: string;
  body: string;
  category: CategoryId;
  data: NotificationData;
}

export interface PlanSettings {
  enabled: boolean;
  /** Ertalab "Bugungi reja" — Bomdoddan 30 daqiqa keyin */
  morningEnabled: boolean;
  /** Boʻlak boshida (namozdan 20 daqiqa keyin) shu boʻlakdagi ishlar */
  blockEnabled: boolean;
  /** Kun yakuni eslatmasi, 'HH:MM' (18:00–23:59) */
  reviewTime: string;
  /** Yotish vaqti eslatmasi — kech yotish muammosi uchun */
  bedtimeEnabled: boolean;
  /** 'HH:MM'; 00:00–11:59 yarim tundan keyin deb olinadi */
  bedtime: string;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  enabled: true,
  morningEnabled: true,
  blockEnabled: true,
  reviewTime: '22:00',
  bedtimeEnabled: true,
  bedtime: '23:00',
};

/** Rejaga kerakli ish maydonlari — faqat OCHIQ ishlar beriladi */
export interface PlanTask {
  id: number;
  title: string;
  day: string;
  block: BlockId | null;
  time: string | null;
  /** daqiqa; 0 = vaqtida; null = eslatmasiz */
  remindBefore: number | null;
  priority: number;
}

export interface PlanInput {
  now: Date;
  /** Necha kun oldinga */
  horizonDays: number;
  cal: PrayerCalendar;
  settings: PlanSettings;
  /** Ufqdagi kunlarning ochiq ishlari */
  tasks: readonly PlanTask[];
  /** Kechqurun rejasi tuzilgan kunlar */
  plannedDays: ReadonlySet<string>;
}

/** Namoz oʻqib boʻlguncha kutiladi — eslatma namoz bilan (Namozim bilan) bir vaqtda kelmasin */
export const MORNING_DELAY_MIN = 30;
export const BLOCK_DELAY_MIN = 20;
/** Xufton kirgandan keyin kun yakuni kamida shuncha kutadi */
const REVIEW_MIN_AFTER_ISHA = 30;

const label = (t: PlanTask) => (t.time ? `${t.title} (${t.time})` : t.title);

/** Boʻlak ichida: vaqtlilar vaqt boʻyicha, keyin asosiylar, keyin qolganlari */
function byOrder(a: PlanTask, b: PlanTask): number {
  if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : a.id - b.id;
  if (a.time) return -1;
  if (b.time) return 1;
  return b.priority - a.priority || a.id - b.id;
}

export function buildPlan(input: PlanInput): PlannedNotification[] {
  const { now, cal, settings } = input;
  if (!settings.enabled) return [];

  const out: PlannedNotification[] = [];
  const t0 = now.getTime();
  const firstDay = cal.prayerDayAt(now);

  const byDay = new Map<string, PlanTask[]>();
  for (const t of input.tasks) byDay.set(t.day, [...(byDay.get(t.day) ?? []), t]);

  for (let i = 0; i < input.horizonDays; i++) {
    const day = addDays(firstDay, i);
    const times = cal.times(day);
    const tasks = [...(byDay.get(day) ?? [])].sort(byOrder);

    // ── Ertalab: bugungi reja ──
    if (settings.morningEnabled && tasks.length) {
      const at = addMinutes(times.bomdod, MORNING_DELAY_MIN);
      if (at.getTime() > t0) {
        const top = tasks.filter((t) => t.priority === 1);
        const rest = tasks.length - top.length;
        out.push({
          id: `morning:${day}`,
          at,
          title: 'Bugungi reja',
          body: top.length
            ? `★ ${clip(top.map(label).join(', '), 80)}${rest ? ` · yana ${rest} ta ish` : ''}`
            : `${tasks.length} ta ish: ${clip(tasks.map(label).join(', '), 80)}`,
          category: 'info',
          data: { kind: 'morning', day, route: '/' },
        });
      }
    }

    // ── Boʻlak boshida: shu boʻlakdagi ishlar ──
    if (settings.blockEnabled) {
      for (const block of BLOCKS) {
        // Ertalabki boʻlak "Bugungi reja" ichida; u oʻchiq boʻlsa — alohida eslatiladi
        if (block === 'morning' && settings.morningEnabled) continue;
        const items = tasks.filter((t) => t.block === block);
        if (!items.length) continue;
        const at = addMinutes(blockStart(times, block), BLOCK_DELAY_MIN);
        if (at.getTime() <= t0) continue;
        out.push({
          id: `block:${day}:${block}`,
          at,
          title: BLOCK_LABEL[block],
          body: clip(items.map(label).join(', '), 100),
          category: 'info',
          data: { kind: 'block', day, block, route: '/' },
        });
      }
    }

    // Xufton kirishidan ertangi Bomdodgacha
    const night = cal.windows(day).xufton;
    const planned = input.plannedDays.has(addDays(day, 1));

    // ── Kun yakuni va ertangi reja ──
    let reviewAt = eveningAt(day, settings.reviewTime);
    const earliest = addMinutes(night.start, REVIEW_MIN_AFTER_ISHA);
    if (reviewAt.getTime() < earliest.getTime()) reviewAt = earliest;
    if (reviewAt.getTime() > t0 && reviewAt.getTime() < night.end.getTime()) {
      const ask = planned ? 'Bugungi kunni yoping — 1 daqiqa.' : 'Kunni yoping va ertangi rejani tuzing — 2 daqiqa.';
      out.push({
        id: `review:${day}`,
        at: reviewAt,
        title: 'Kun yakuni',
        body: tasks.length ? `${ask} Ochiq ishlar: ${tasks.length} ta.` : ask,
        category: 'info',
        data: { kind: 'review', day, route: '/review' },
      });
    }

    // ── Yotish vaqti ──
    if (settings.bedtimeEnabled) {
      const at = eveningAt(day, settings.bedtime);
      const wake = night.end; // ertangi Bomdod
      if (at.getTime() > t0 && at.getTime() < wake.getTime()) {
        const hours = String(sleepHoursUntil(at, wake)).replace('.', ',');
        out.push({
          id: `sleep:${day}`,
          at,
          title: 'Yotish vaqti',
          body:
            `Ertangi Bomdod ${hhmm(wake)} da — hozir yotsangiz ${hours} soat uxlaysiz.` +
            (planned ? ' Reja tayyor.' : ' Ertangi reja hali tuzilmagan.'),
          category: 'info',
          data: { kind: 'sleep', day, ...(planned ? {} : { route: '/review' }) },
        });
      }
    }
  }

  // ── Vaqtli ishlar ──
  for (const t of input.tasks) {
    if (!t.time || t.remindBefore === null) continue;
    const moment = momentOnPrayerDay(cal.times(t.day), t.day, t.time);
    const at = addMinutes(moment, -t.remindBefore);
    if (at.getTime() <= t0) continue;
    out.push({
      id: `task:${t.id}`,
      at,
      title: t.title,
      body: t.remindBefore > 0 ? `${hhmm(moment)} da · ${formatBefore(t.remindBefore)} qoldi` : `Vaqti keldi · ${hhmm(moment)}`,
      category: 'task',
      data: { kind: 'task', taskId: t.id, day: t.day, route: '/' },
    });
  }

  return out.map((n) => ({ ...n, data: { ...n.data, h: contentHash(n) } }));
}

function formatBefore(min: number): string {
  if (min % 60 === 0) return `${min / 60} soat`;
  return `${min} daqiqa`;
}

/**
 * Bildirishnoma kontentidan bizning `data` ni oʻqish.
 *
 * ⚠️ Android'da rejalashtirilgan bildirishnoma maʼlumoti faqat `content.dataString`
 * (JSON satr) sifatida saqlanadi (NotificationSerializer.toBundle(request)). JS tomoni
 * uni `content.data` ga faqat tinglovchi / getAllScheduled… / getPresented… yoʻllarida
 * aylantiradi. Fon vazifasi esa XOM bundle oladi — u yerda `data` yoʻq, faqat
 * `dataString` bor. Shuning uchun ikkalasi ham tekshiriladi.
 */
export function readData(content: unknown): NotificationData {
  const c = (content ?? {}) as { data?: unknown; dataString?: unknown };
  if (c.data && typeof c.data === 'object') return c.data as NotificationData;
  if (typeof c.dataString === 'string') {
    try {
      const parsed = JSON.parse(c.dataString) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as NotificationData;
    } catch {
      // pastga
    }
  }
  return { kind: 'unknown' };
}

/** Kichik, barqaror xesh (djb2) — kriptografik emas, faqat oʻzgarishni sezish uchun */
export function contentHash(n: Omit<PlannedNotification, 'data'> & { data: NotificationData }): string {
  const { h: _ignored, ...data } = n.data;
  const s = `${n.at.getTime()}|${n.title}|${n.body}|${n.category}|${JSON.stringify(data)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
