/**
 * Ilova sozlamalari — `settings` jadvalida kalit-qiymat koʻrinishida.
 * Har bir qiymat oʻqilganda tekshiriladi: buzilgan yoki eski qiymat ilovani
 * yiqitmasin, sukut boʻyicha qiymatga qaytsin.
 */

import { getSetting, setSetting } from '../db/client';
import { type AlarmSettings, DEFAULT_ALARM_SETTINGS } from './alarm-plan';
import { emitChange } from './events';
import { type Adjustments, NO_ADJUSTMENTS, TIME_KEYS } from './prayer-times';
import { DEFAULT_PLAN_SETTINGS, type PlanSettings } from './schedule';
import { parseHm } from './time';

export interface AppSettings extends PlanSettings, AlarmSettings {
  adjustments: Adjustments;
  /** Kuzatuv boshlangan vaqt (ISO). Bundan oldingi namozlar qazoga yozilmaydi. */
  trackingStart: string;
  /** Huawei "Запуск приложений" sozlamasi bajarildi (tekshirib boʻlmaydi — foydalanuvchi tasdiqlaydi) */
  huaweiLaunchDone: boolean;
}

const KEYS = {
  adjustments: 'adjustments',
  trackingStart: 'tracking_start',
  huaweiLaunchDone: 'huawei_launch_done',
  enabled: 'notifications_enabled',
  warnMinutes: 'warn_minutes',
  reviewTime: 'review_time',
  qazoReminder: 'qazo_reminder',
  qazoTime: 'qazo_time',
  qazoDailyDays: 'qazo_daily_days',
  alarmEnabled: 'alarm_enabled',
  alarmOffset: 'alarm_offset',
  alarmMaxSnooze: 'alarm_max_snooze',
  alarmSnoozeMinutes: 'alarm_snooze_minutes',
  alarmCheck: 'alarm_check',
  alarmCheckDelay: 'alarm_check_delay',
  alarmChallenge: 'alarm_challenge',
} as const;

function readBool(key: string, fallback: boolean): boolean {
  const v = getSetting(key);
  return v === null ? fallback : v === '1';
}

function readInt(key: string, fallback: number, min: number, max: number): number {
  const raw = getSetting(key);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

function readTime(key: string, fallback: string): string {
  const v = getSetting(key);
  return v !== null && parseHm(v) !== null ? v : fallback;
}

function readAdjustments(): Adjustments {
  try {
    const raw = JSON.parse(getSetting(KEYS.adjustments) ?? '{}') as Partial<Record<string, unknown>>;
    const out = { ...NO_ADJUSTMENTS };
    for (const k of TIME_KEYS) {
      const n = Number(raw[k]);
      if (Number.isFinite(n)) out[k] = Math.max(-30, Math.min(30, Math.round(n)));
    }
    return out;
  } catch {
    return { ...NO_ADJUSTMENTS };
  }
}

/** Birinchi ishga tushishda kuzatuv boshlanish vaqtini belgilaydi */
export function ensureTrackingStart(now = new Date()): string {
  const existing = getSetting(KEYS.trackingStart);
  if (existing && !Number.isNaN(Date.parse(existing))) return existing;
  const iso = now.toISOString();
  setSetting(KEYS.trackingStart, iso);
  return iso;
}

export function loadSettings(): AppSettings {
  const d = DEFAULT_PLAN_SETTINGS;
  const a = DEFAULT_ALARM_SETTINGS;
  return {
    adjustments: readAdjustments(),
    trackingStart: ensureTrackingStart(),
    huaweiLaunchDone: readBool(KEYS.huaweiLaunchDone, false),
    enabled: readBool(KEYS.enabled, d.enabled),
    warnMinutes: readInt(KEYS.warnMinutes, d.warnMinutes, 10, 60),
    reviewTime: readTime(KEYS.reviewTime, d.reviewTime),
    qazoReminder: readBool(KEYS.qazoReminder, d.qazoReminder),
    qazoTime: readTime(KEYS.qazoTime, d.qazoTime),
    qazoDailyDays: readInt(KEYS.qazoDailyDays, d.qazoDailyDays, 1, 10),
    alarmEnabled: readBool(KEYS.alarmEnabled, a.alarmEnabled),
    alarmOffset: readInt(KEYS.alarmOffset, a.alarmOffset, 0, 60),
    alarmMaxSnooze: readInt(KEYS.alarmMaxSnooze, a.alarmMaxSnooze, 0, 5),
    alarmSnoozeMinutes: readInt(KEYS.alarmSnoozeMinutes, a.alarmSnoozeMinutes, 1, 15),
    alarmCheck: readBool(KEYS.alarmCheck, a.alarmCheck),
    alarmCheckDelay: readInt(KEYS.alarmCheckDelay, a.alarmCheckDelay, 5, 30),
    alarmChallenge: readBool(KEYS.alarmChallenge, a.alarmChallenge),
  };
}

export function saveSettings(patch: Partial<Omit<AppSettings, 'trackingStart'>>): void {
  for (const [k, v] of Object.entries(patch)) {
    const key = KEYS[k as keyof typeof KEYS];
    if (!key || v === undefined) continue;
    const value = typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    setSetting(key, value);
  }
  emitChange();
}
