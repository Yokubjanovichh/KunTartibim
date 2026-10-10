/**
 * Namozlar roʻyxati — butun ilova shu tartibga tayanadi.
 * Vitr Hanafiy mazhabida vojib, qazosi ham hisoblanadi (foydalanuvchi tanlovi).
 */

export const PRAYERS = ['bomdod', 'peshin', 'asr', 'shom', 'xufton', 'vitr'] as const;
export type PrayerId = (typeof PRAYERS)[number];

/** Vaqti alohida kiradigan besh farz — vitr xufton oynasida oʻqiladi */
export const FARZ: readonly PrayerId[] = ['bomdod', 'peshin', 'asr', 'shom', 'xufton'];

export const PRAYER_NAME: Record<PrayerId, string> = {
  bomdod: 'Bomdod',
  peshin: 'Peshin',
  asr: 'Asr',
  shom: 'Shom',
  xufton: 'Xufton',
  vitr: 'Vitr',
};

export function isPrayerId(value: unknown): value is PrayerId {
  return typeof value === 'string' && (PRAYERS as readonly string[]).includes(value);
}

/** Bazadagi va bildirishnomadagi kalit: '2026-10-09:asr' */
export function prayerKey(day: string, prayer: PrayerId): string {
  return `${day}:${prayer}`;
}
