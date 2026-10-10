/**
 * Ilova sozlamalari — `settings` jadvalida kalit-qiymat koʻrinishida.
 * Har bir qiymat oʻqilganda tekshiriladi: buzilgan yoki eski qiymat ilovani
 * yiqitmasin, sukut boʻyicha qiymatga qaytsin.
 */

import { getSetting, setSetting } from '../db/client';
import { emitChange } from './events';
import { type Adjustments, NO_ADJUSTMENTS, TIME_KEYS } from './prayer-times';
import { DEFAULT_PLAN_SETTINGS, type PlanSettings } from './schedule';
import { parseHm } from './time';

export interface AppSettings extends PlanSettings {
  /** Namoz vaqtlariga tuzatishlar — Namozimdan koʻchiriladi, kun boʻlaklari shunga moslashadi */
  adjustments: Adjustments;
  /** Huawei "Запуск приложений" sozlamasi bajarildi (tekshirib boʻlmaydi — foydalanuvchi tasdiqlaydi) */
  huaweiLaunchDone: boolean;
  /** Namozimdan maʼlumot koʻchirilgan vaqt (ISO) — hali koʻchirilmagan boʻlsa null */
  importedAt: string | null;
}

const KEYS = {
  adjustments: 'adjustments',
  huaweiLaunchDone: 'huawei_launch_done',
  importedAt: 'imported_at',
  enabled: 'notifications_enabled',
  morningEnabled: 'morning_enabled',
  blockEnabled: 'block_enabled',
  reviewTime: 'review_time',
  bedtimeEnabled: 'bedtime_enabled',
  bedtime: 'bedtime',
} as const;

function readBool(key: string, fallback: boolean): boolean {
  const v = getSetting(key);
  return v === null ? fallback : v === '1';
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

export function loadSettings(): AppSettings {
  const d = DEFAULT_PLAN_SETTINGS;
  const imported = getSetting(KEYS.importedAt);
  return {
    adjustments: readAdjustments(),
    huaweiLaunchDone: readBool(KEYS.huaweiLaunchDone, false),
    importedAt: imported && !Number.isNaN(Date.parse(imported)) ? imported : null,
    enabled: readBool(KEYS.enabled, d.enabled),
    morningEnabled: readBool(KEYS.morningEnabled, d.morningEnabled),
    blockEnabled: readBool(KEYS.blockEnabled, d.blockEnabled),
    reviewTime: readTime(KEYS.reviewTime, d.reviewTime),
    bedtimeEnabled: readBool(KEYS.bedtimeEnabled, d.bedtimeEnabled),
    bedtime: readTime(KEYS.bedtime, d.bedtime),
  };
}

export function saveSettings(patch: Partial<AppSettings>): void {
  for (const [k, v] of Object.entries(patch)) {
    const key = KEYS[k as keyof typeof KEYS];
    if (!key || v === undefined || v === null) continue;
    const value = typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    setSetting(key, value);
  }
  emitChange();
}
