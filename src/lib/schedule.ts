/**
 * Eslatmalar rejasi — sof mantiq (testlanadi).
 * -------------------------------------------
 * Bu modul faqat "qaysi bildirishnoma qachon chiqishi kerak" degan roʻyxatni
 * tuzadi. Telefonga qoʻyish `notifications.ts` ning ishi: u mavjudlari bilan
 * solishtirib, faqat oʻzgarganlarini qayta qoʻyadi.
 *
 * Har bir namoz uchun:
 *   start — vaqt kirganda ("Peshin vaqti kirdi" + [Oʻqidim])
 *   warn  — vaqt chiqishiga N daqiqa qolganda, hali belgilanmagan boʻlsa
 * Har kuni:
 *   review — kun yakuni: Xufton/Vitr tekshiruvi va Tahlil ekraniga taklif
 *   qazo   — qazo qarzi boʻlsa, kunlik eslatma
 *
 * Belgilangan namozning eslatmalari rejaga kirmaydi — sinxronlash ularni bekor qiladi.
 */

import { sleepHoursUntil } from './habits';
import type { PrayerCalendar } from './prayer-times';
import { FARZ, PRAYER_NAME, type PrayerId, prayerKey } from './prayers';
import type { RecordStatus } from './status';
import { addDays, addMinutes, atTime, eveningAt, hhmm } from './time';

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export type NotificationKind = 'start' | 'warn' | 'review' | 'qazo' | 'sleep' | 'snooze' | 'test' | 'unknown';

/**
 * Bildirishnoma tugmalari toʻplamlari.
 *   prayer — [Oʻqidim] [15 daqiqadan keyin]
 *   isha   — [Xufton ✓] [Xufton + Vitr ✓] [15 daqiqadan keyin]
 *   review — [Hammasini oʻqidim ✓]
 *   qazo   — [Oʻqidim ✓]
 *   info   — tugmasiz
 */
export type CategoryId = 'prayer' | 'isha' | 'review' | 'qazo' | 'info';

export interface NotificationData {
  kind: NotificationKind;
  day?: string;
  prayers?: PrayerId[];
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
  /** Vaqt chiqishidan necha daqiqa oldin ogohlantirish */
  warnMinutes: number;
  /** Kun yakuni eslatmasi, 'HH:MM' (18:00–23:59) */
  reviewTime: string;
  qazoReminder: boolean;
  qazoTime: string;
  /** Kunlik qazo maqsadi — necha kunlik (1 kunlik = 6 namoz) */
  qazoDailyDays: number;
  /** Yotish vaqti eslatmasi — kech yotish muammosi uchun */
  bedtimeEnabled: boolean;
  /** 'HH:MM'; 00:00–11:59 yarim tundan keyin deb olinadi */
  bedtime: string;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  enabled: true,
  warnMinutes: 30,
  reviewTime: '22:00',
  qazoReminder: true,
  qazoTime: '20:30',
  qazoDailyDays: 1,
  bedtimeEnabled: true,
  bedtime: '23:00',
};

export interface PlanInput {
  now: Date;
  /** Necha kun oldinga. 10 kun ≈ 120 ta eslatma (Android chegarasi 500). */
  horizonDays: number;
  cal: PrayerCalendar;
  records: ReadonlyMap<string, RecordStatus>;
  settings: PlanSettings;
  qazoTotal: number;
  /** Kun → oʻsha kunning ochiq "asosiy" ishlari (Bomdod eslatmasida koʻrsatiladi) */
  topTasks?: ReadonlyMap<string, string[]>;
  /** Kechqurun rejasi tuzilgan kunlar */
  plannedDays?: ReadonlySet<string>;
}

const END_LABEL: Record<string, string> = {
  bomdod: 'Quyosh chiqadi',
  peshin: 'Asr kiradi',
  asr: 'Quyosh botadi',
  shom: 'Xufton kiradi',
};

/** Xufton kirgandan keyin kun yakuni kamida shuncha kutadi */
const REVIEW_MIN_AFTER_ISHA = 30;

export function buildPlan(input: PlanInput): PlannedNotification[] {
  const { now, cal, records, settings } = input;
  if (!settings.enabled) return [];

  const out: PlannedNotification[] = [];
  const t0 = now.getTime();
  const firstDay = cal.prayerDayAt(now);
  const marked = (day: string, p: PrayerId) => records.has(prayerKey(day, p));

  for (let i = 0; i < input.horizonDays; i++) {
    const day = addDays(firstDay, i);
    const w = cal.windows(day);

    for (const p of FARZ) {
      if (marked(day, p)) continue;
      const win = w[p];

      if (win.start.getTime() > t0) {
        // Ertalab birinchi koʻriladigan narsa — kunning asosiy ishi shu yerda turadi
        const top = p === 'bomdod' ? (input.topTasks?.get(day) ?? []) : [];
        const tail =
          p === 'xufton'
            ? ' · Vitrni ham unutmang'
            : top.length
              ? ` · Bugun asosiy: ${clip(top.join(', '), 60)}`
              : ' · Oʻqigach belgilang';
        out.push({
          id: `start:${day}:${p}`,
          at: win.start,
          title: `${PRAYER_NAME[p]} vaqti kirdi`,
          body: `${hhmm(win.start)} – ${hhmm(win.end)}${tail}`,
          category: p === 'xufton' ? 'isha' : 'prayer',
          data: { kind: 'start', day, prayers: [p] },
        });
      }

      // Xufton oynasi ertangi Bomdodgacha — tungi ogohlantirish oʻrniga kun yakuni bor
      if (p !== 'xufton') {
        const warnAt = addMinutes(win.end, -settings.warnMinutes);
        if (warnAt.getTime() > t0 && warnAt.getTime() > win.start.getTime()) {
          out.push({
            id: `warn:${day}:${p}`,
            at: warnAt,
            title: `${PRAYER_NAME[p]} vaqti tugayapti`,
            body: `${END_LABEL[p]}: ${hhmm(win.end)} · ${settings.warnMinutes} daqiqa qoldi`,
            category: 'prayer',
            data: { kind: 'warn', day, prayers: [p] },
          });
        }
      }
    }

    // ── Kun yakuni va ertangi reja ──
    const isha = w.xufton;
    const nextDay = addDays(day, 1);
    const planned = input.plannedDays?.has(nextDay) ?? false;
    let reviewAt = eveningAt(day, settings.reviewTime);
    const earliest = addMinutes(isha.start, REVIEW_MIN_AFTER_ISHA);
    if (reviewAt.getTime() < earliest.getTime()) reviewAt = earliest;
    if (reviewAt.getTime() > t0 && reviewAt.getTime() < isha.end.getTime()) {
      const pending = (['xufton', 'vitr'] as PrayerId[]).filter((p) => !marked(day, p));
      const names = pending.map((p) => PRAYER_NAME[p]).join(' va ');
      const ask = planned ? 'Bugungi kunni yoping — 1 daqiqa.' : 'Kunni yoping va ertangi rejani tuzing — 2 daqiqa.';
      out.push({
        id: `review:${day}`,
        at: reviewAt,
        title: 'Kun yakuni',
        body: pending.length ? `${names} belgilanmagan. ${ask}` : ask,
        category: pending.length ? 'review' : 'info',
        data: { kind: 'review', day, prayers: pending, route: '/review' },
      });
    }

    // ── Yotish vaqti ──
    if (settings.bedtimeEnabled) {
      const at = eveningAt(day, settings.bedtime);
      const wake = w.xufton.end; // ertangi Bomdod
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

    // ── Qazo eslatmasi ──
    if (settings.qazoReminder && input.qazoTotal > 0) {
      const at = atTime(day, settings.qazoTime);
      if (at.getTime() > t0) {
        out.push({
          id: `qazo:${day}`,
          at,
          title: 'Qazo namozlar',
          body: `Qolgan: ${input.qazoTotal} ta · Bugungi maqsad: ${settings.qazoDailyDays} kunlik`,
          category: 'qazo',
          data: { kind: 'qazo', day, route: '/qazo' },
        });
      }
    }
  }

  return out.map((n) => ({ ...n, data: { ...n.data, h: contentHash(n) } }));
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
