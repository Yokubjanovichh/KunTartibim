/**
 * Namoz holati — sof mantiq, baza va UI'siz (testlanadi).
 *
 * Bazada faqat aniq faktlar saqlanadi: 'prayed' yoki 'qazo'. Qolgan holatlar
 * vaqtdan kelib chiqadi. Vaqti chiqqan, lekin belgilanmagan namoz 'missed' —
 * `reconcile` uni bazaga 'qazo' (manba: auto) qilib yozadi. Foydalanuvchi keyin
 * "aslida oʻqigandim" deb tuzatishi mumkin.
 */

import type { PrayerCalendar, PrayerWindow } from './prayer-times';
import { PRAYERS, type PrayerId, prayerKey } from './prayers';
import { addDays } from './time';

export type RecordStatus = 'prayed' | 'qazo';

export type PrayerStatus =
  | RecordStatus
  /** Vaqti hali kirmagan */
  | 'upcoming'
  /** Vaqti kirgan, hali chiqmagan, belgilanmagan */
  | 'active'
  /** Vaqti chiqqan, belgilanmagan — qazo boʻladi */
  | 'missed'
  /** Kuzatuv boshlanishidan oldingi namoz — qazoga yozilmaydi */
  | 'untracked';

export function deriveStatus(
  win: PrayerWindow,
  record: RecordStatus | undefined,
  now: Date,
  trackingStart: Date,
): PrayerStatus {
  if (record) return record;
  const t = now.getTime();
  if (t < win.start.getTime()) return 'upcoming';
  if (t < win.end.getTime()) return 'active';
  return win.start.getTime() >= trackingStart.getTime() ? 'missed' : 'untracked';
}

/** Kelajakdagi namozni belgilab boʻlmaydi */
export function canMark(win: PrayerWindow, now: Date): boolean {
  return now.getTime() >= win.start.getTime();
}

/**
 * `fromDay` dan boshlab vaqti chiqqan va belgilanmagan namozlar.
 * Kuzatuv boshlanishidan oldin kirgan namozlar hisobga olinmaydi —
 * ilovani oʻrnatgan kuni ertalabki Bomdod "qazo" boʻlib qolmasligi uchun.
 */
export function findMissed(
  cal: PrayerCalendar,
  fromDay: string,
  now: Date,
  trackingStart: Date,
  records: ReadonlyMap<string, RecordStatus>,
): { day: string; prayer: PrayerId }[] {
  const out: { day: string; prayer: PrayerId }[] = [];
  const lastDay = cal.prayerDayAt(now);
  for (let day = fromDay; day <= lastDay; day = addDays(day, 1)) {
    const wins = cal.windows(day);
    for (const p of PRAYERS) {
      const s = deriveStatus(wins[p], records.get(prayerKey(day, p)), now, trackingStart);
      if (s === 'missed') out.push({ day, prayer: p });
    }
  }
  return out;
}

/** Bir kunning hamma namozlari holati */
export function dayStatuses(
  cal: PrayerCalendar,
  day: string,
  records: ReadonlyMap<string, RecordStatus>,
  now: Date,
  trackingStart: Date,
): Record<PrayerId, PrayerStatus> {
  const wins = cal.windows(day);
  const out = {} as Record<PrayerId, PrayerStatus>;
  for (const p of PRAYERS) out[p] = deriveStatus(wins[p], records.get(prayerKey(day, p)), now, trackingStart);
  return out;
}

export interface RangeStats {
  /** Hisobga kirgan namozlar: oʻqilgan + qazo (davom etayotgan va kuzatuvdan oldingilar kirmaydi) */
  tracked: number;
  prayed: number;
  qazo: number;
  /** Vaqti hali davom etayotganlar */
  pending: number;
  byPrayer: Record<PrayerId, { prayed: number; qazo: number }>;
}

/** Tahlil uchun: [fromDay, toDay] oraligʻidagi natija */
export function rangeStats(
  cal: PrayerCalendar,
  fromDay: string,
  toDay: string,
  records: ReadonlyMap<string, RecordStatus>,
  now: Date,
  trackingStart: Date,
): RangeStats {
  const byPrayer = {} as RangeStats['byPrayer'];
  for (const p of PRAYERS) byPrayer[p] = { prayed: 0, qazo: 0 };
  const stats: RangeStats = { tracked: 0, prayed: 0, qazo: 0, pending: 0, byPrayer };

  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const s = dayStatuses(cal, day, records, now, trackingStart);
    for (const p of PRAYERS) {
      if (s[p] === 'prayed') {
        stats.prayed++;
        stats.tracked++;
        byPrayer[p].prayed++;
      } else if (s[p] === 'qazo' || s[p] === 'missed') {
        stats.qazo++;
        stats.tracked++;
        byPrayer[p].qazo++;
      } else if (s[p] === 'active') {
        stats.pending++;
      }
    }
  }
  return stats;
}

/** Hozirgi (vaqti kirgan va chiqmagan) birinchi farz yoki keyingi kiradigani */
export interface NowInfo {
  /** Hozir vaqti davom etayotgan namoz (Vitr hisobga olinmaydi — Xufton bilan bir oyna) */
  current: PrayerWindow | null;
  /** Keyingi kiradigan namoz */
  next: PrayerWindow;
}

export function nowInfo(cal: PrayerCalendar, now: Date): NowInfo {
  const day = cal.prayerDayAt(now);
  const t = now.getTime();
  const order: PrayerId[] = ['bomdod', 'peshin', 'asr', 'shom', 'xufton'];
  const today = cal.windows(day);
  const current = order.map((p) => today[p]).find((w) => t >= w.start.getTime() && t < w.end.getTime()) ?? null;
  const upcoming = order.map((p) => today[p]).find((w) => w.start.getTime() > t);
  const next = upcoming ?? cal.windows(addDays(day, 1)).bomdod;
  return { current, next };
}
