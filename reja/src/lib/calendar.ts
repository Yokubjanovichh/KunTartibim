/**
 * Namoz vaqtlari — bu ilovada faqat SOAT sifatida: kun boʻlaklari ("Asrdan keyin")
 * shu vaqtlarga tayanadi va yil davomida ular bilan birga siljiydi. Namoz
 * oʻqilganini kuzatish — Namozim ilovasining ishi, bu yerda yoʻq.
 */

import { PrayerCalendar, TORAQORGON } from './prayer-times';
import { type AppSettings, loadSettings } from './settings';

let calCache: { key: string; cal: PrayerCalendar } | null = null;

/** Tuzatishlar (Namozimdan koʻchirilgan) bilan taqvim. Tuzatish oʻzgarsa — yangisi. */
export function calendarFor(settings: Pick<AppSettings, 'adjustments'> = loadSettings()): PrayerCalendar {
  const key = JSON.stringify(settings.adjustments);
  if (!calCache || calCache.key !== key) {
    calCache = { key, cal: new PrayerCalendar(TORAQORGON, settings.adjustments) };
  }
  return calCache.cal;
}
