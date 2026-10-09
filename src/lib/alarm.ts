/**
 * Bomdod budilnigi — native modul (modules/bomdod-alarm) bilan aloqa.
 *
 * Modul faqat 1.1.0+ APK'da bor. Eski APK yoki Expo Go'da `Native` null —
 * hamma funksiya jimgina hech narsa qilmaydi, ilova yiqilmaydi.
 */

import { requireOptionalNativeModule } from 'expo';

import type { AlarmConfig, AlarmItem } from './alarm-plan';

export interface WakeLogEntry {
  /** Rejalangan budilnik vaqti */
  at: number;
  firedAt: number;
  /** 0 — javobsiz tugagan (uygʻonmagan) */
  dismissedAt: number;
  snoozes: number;
  /** "Turdingizmi?"ga javob bermagani uchun qayta chalgan */
  rechecked: boolean;
  /** "Turdim" bosilgan, lekin qayta chalishga javob boʻlmadi — qayta uxlab qolgan */
  asleep?: boolean;
}

export interface AlarmStatus {
  next: number | null;
  canScheduleExact: boolean;
  canFullScreen: boolean;
  ringing: boolean;
}

interface NativeAlarm {
  setSchedule(alarms: AlarmItem[], config: AlarmConfig): void;
  clear(): void;
  testIn(seconds: number): void;
  confirmAwake(): void;
  getLog(): WakeLogEntry[];
  status(): AlarmStatus;
  openFullScreenSettings(): boolean;
}

const Native = requireOptionalNativeModule<NativeAlarm>('BomdodAlarm');

export const alarmSupported = Native !== null;

export function setAlarmSchedule(items: AlarmItem[], config: AlarmConfig): void {
  if (!Native) return;
  if (items.length) Native.setSchedule(items, config);
  else Native.clear();
}

export function testAlarm(seconds = 30): boolean {
  if (!Native) return false;
  Native.testIn(seconds);
  return true;
}

/** Bomdod "oʻqildi" deb belgilanganda — "Turdingizmi?" tekshiruvi kerak emas */
export function confirmAwake(): void {
  Native?.confirmAwake();
}

export function wakeLog(): WakeLogEntry[] {
  try {
    return Native?.getLog() ?? [];
  } catch {
    return [];
  }
}

export function alarmStatus(): AlarmStatus | null {
  try {
    return Native?.status() ?? null;
  } catch {
    return null;
  }
}

export function openFullScreenSettings(): boolean {
  return Native?.openFullScreenSettings() ?? false;
}
