/**
 * Bomdod budilnigi rejasi — sof mantiq (testlanadi).
 *
 * Native modul vaqtlarni hisoblay olmaydi (adhan JS'da), shuning uchun JS keyingi
 * ~2 haftalik budilniklar roʻyxatini beradi; native tomoni har chalinishdan keyin
 * keyingisini oʻzi qoʻyadi. Bomdod har kuni siljigani uchun har bir kun alohida.
 */

import type { PrayerCalendar } from './prayer-times';
import { prayerKey } from './prayers';
import type { RecordStatus } from './status';
import { addDays, addMinutes, hhmm } from './time';

export interface AlarmSettings {
  alarmEnabled: boolean;
  /** Bomdod kirgandan necha daqiqa keyin (0 = darhol) */
  alarmOffset: number;
  /** Keyinga surish: necha marta (0 = surib boʻlmaydi) */
  alarmMaxSnooze: number;
  alarmSnoozeMinutes: number;
  /** "Turdim"dan keyin "Turdingizmi?" — javob boʻlmasa qayta chaladi */
  alarmCheck: boolean;
  /** Tekshiruv necha daqiqadan keyin — tahoratga borib kelishga yetsin (foydalanuvchi: 15) */
  alarmCheckDelay: number;
  /** Oʻchirish uchun misol yechish */
  alarmChallenge: boolean;
}

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  alarmEnabled: true,
  alarmOffset: 0,
  alarmMaxSnooze: 2,
  alarmSnoozeMinutes: 5,
  alarmCheck: true,
  alarmCheckDelay: 15,
  alarmChallenge: false,
};

/** Quyosh chiqishidan kamida shuncha oldin uygʻotish — namozga vaqt qolsin */
export const MIN_BEFORE_SUNRISE = 20;

export interface AlarmItem {
  at: number;
  /** Bomdod oynasining oxiri (quyosh chiqishi) — budilnik ekranida "N daqiqa qoldi" */
  endAt: number;
  title: string;
  body: string;
}

export interface AlarmConfig {
  snoozeMinutes: number;
  maxSnoozes: number;
  checkEnabled: boolean;
  checkDelayMinutes: number;
  recheckMinutes: number;
  challenge: boolean;
  ringMinutes: number;
}

/** Bir kunning budilnik vaqti: Bomdod + offset, lekin quyosh chiqishidan 20 daqiqa oldindan kech emas */
export function alarmTimeFor(cal: PrayerCalendar, day: string, offset: number): Date {
  const t = cal.times(day);
  const latest = addMinutes(t.quyosh, -MIN_BEFORE_SUNRISE);
  const at = addMinutes(t.bomdod, offset);
  return at.getTime() > latest.getTime() ? latest : at;
}

export function buildAlarmPlan(
  cal: PrayerCalendar,
  now: Date,
  days: number,
  settings: AlarmSettings,
  records: ReadonlyMap<string, RecordStatus>,
): AlarmItem[] {
  if (!settings.alarmEnabled) return [];
  const out: AlarmItem[] = [];
  const first = cal.prayerDayAt(now);
  for (let i = 0; i <= days; i++) {
    const day = addDays(first, i);
    // Oʻzi turib, Bomdodni allaqachon belgilagan boʻlsa — budilnik kerak emas
    if (records.has(prayerKey(day, 'bomdod'))) continue;
    const at = alarmTimeFor(cal, day, settings.alarmOffset);
    if (at.getTime() <= now.getTime()) continue;
    const t = cal.times(day);
    out.push({
      at: at.getTime(),
      endAt: t.quyosh.getTime(),
      title: 'Bomdod vaqti',
      body: `${hhmm(t.bomdod)} – ${hhmm(t.quyosh)}`,
    });
  }
  return out;
}

export function alarmConfigFrom(s: AlarmSettings): AlarmConfig {
  return {
    snoozeMinutes: s.alarmSnoozeMinutes,
    maxSnoozes: s.alarmMaxSnooze,
    checkEnabled: s.alarmCheck,
    checkDelayMinutes: s.alarmCheckDelay,
    recheckMinutes: 3,
    challenge: s.alarmChallenge,
    ringMinutes: 5,
  };
}
