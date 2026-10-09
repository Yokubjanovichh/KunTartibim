/**
 * Sana va vaqt yordamchilari.
 *
 * Kun har doim mahalliy sana boʻyicha ISO satr: '2026-10-09'. Shunda SQL'da
 * solishtirish ham, ekranda koʻrsatish ham bir xil ishlaydi. Telefon vaqt zonasi
 * Asia/Tashkent (UTC+5, yozgi vaqt yoʻq) — hisob-kitob qurilma vaqtiga tayanadi.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '2026-10-09' → oʻsha kunning mahalliy yarim tuni */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** Ikki kun orasidagi kunlar soni (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** '22:30' → 1350 daqiqa. Notoʻgʻri satr uchun null. */
export function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatHm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Kun + 'HH:MM' → aniq vaqt */
export function atTime(day: string, value: string): Date {
  const minutes = parseHm(value) ?? 0;
  const d = parseDay(day);
  d.setMinutes(minutes);
  return d;
}

/** 4 500 000 ms → "1 soat 15 daqiqa"; 1 daqiqadan kam boʻlsa "1 daqiqa" */
export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} daqiqa`;
  if (m === 0) return `${h} soat`;
  return `${h} soat ${m} daqiqa`;
}

/** Qisqa koʻrinish: "1:15" yoki "45 daq" */
export function formatDurationShort(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m} daq` : `${h}:${pad(m)}`;
}

export const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
export const WEEKDAYS_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
export const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** "Payshanba, 9-oktabr" */
export function formatDayLong(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`;
}

/** "9-okt" — jadval va roʻyxatlar uchun */
export function formatDayShort(day: string): string {
  const d = parseDay(day);
  return `${d.getDate()}-${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function weekdayShort(day: string): string {
  return WEEKDAYS_SHORT[parseDay(day).getDay()];
}

/** Haftaning dushanbasi (Oʻzbekistonda hafta dushanbadan boshlanadi) */
export function weekStart(day: string): string {
  const dow = parseDay(day).getDay(); // 0 = yakshanba
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}
