/**
 * "Real API" bilan solishtirish.
 *
 * Ilova vaqtlarni oʻzi hisoblaydi (internetsiz), lekin foydalanuvchi xohlasa
 * mustaqil manba bilan tekshira oladi. Aladhan API'ga islom.uz parametrlari
 * beriladi — natija ±1 daqiqa mos kelishi kerak (2026-10-09 da tekshirilgan).
 * API "Maghrib" = quyosh botishi; Shom esa botish + 4 daqiqa.
 */

import { computeDayTimes, NO_ADJUSTMENTS, OFFICIAL_PARAMS, type Place } from './prayer-times';
import { hhmm, parseDay, parseHm } from './time';

export interface CompareRow {
  label: string;
  app: string;
  api: string;
  /** daqiqa (ilova − API) */
  diff: number;
}

export async function compareWithAladhan(day: string, place: Place): Promise<CompareRow[]> {
  const d = parseDay(day);
  const dd = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const url =
    `https://api.aladhan.com/v1/timings/${dd}?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&method=99&methodSettings=${OFFICIAL_PARAMS.fajrAngle},null,${OFFICIAL_PARAMS.ishaAngle}` +
    `&school=1&timezonestring=Asia/Tashkent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let json: { data?: { timings?: Record<string, string> } };
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`API javobi: ${res.status}`);
    json = await res.json();
  } finally {
    clearTimeout(timeout);
  }

  const t = json.data?.timings;
  if (!t) throw new Error('API kutilmagan javob qaytardi');

  // Tuzatishlarsiz — formulaning oʻzini solishtiramiz
  const mine = computeDayTimes(day, place, NO_ADJUSTMENTS);
  const pairs: [string, Date, string | undefined][] = [
    ['Bomdod', mine.bomdod, t.Fajr],
    ['Quyosh', mine.quyosh, t.Sunrise],
    ['Peshin', mine.peshin, t.Dhuhr],
    ['Asr', mine.asr, t.Asr],
    ['Quyosh botishi', mine.sunset, t.Maghrib],
    ['Xufton', mine.xufton, t.Isha],
  ];

  return pairs.map(([label, date, raw]) => {
    const apiHm = (raw ?? '').slice(0, 5);
    const appMin = date.getHours() * 60 + date.getMinutes();
    const apiMin = parseHm(apiHm);
    return { label, app: hhmm(date), api: apiHm || '—', diff: apiMin === null ? NaN : appMin - apiMin };
  });
}
