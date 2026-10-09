/**
 * Namoz vaqtlarini hisoblash — internet kerak emas.
 * ------------------------------------------------
 * Parametrlar islom.uz (Oʻzbekiston musulmonlari idorasi) saytining oʻz kodidan
 * olingan (2026-10-09 da tekshirilgan): sayt vaqtlarni API'dan emas, aynan shu
 * `adhan` kutubxonasi bilan brauzerda hisoblaydi:
 *
 *   CalculationMethod.Other() · fajrAngle 15.5 · ishaAngle 15.5 · madhab Hanafi
 *   Shom = quyosh botishi + 4 daqiqa
 *
 * Shuning uchun telefonda hisoblangan vaqt rasmiy sayt bilan bir xil chiqadi va
 * API oʻchib qolsa ham eslatmalar ishlayveradi. Manbalar orasidagi 3–4 daqiqalik
 * farq (masalan, namozvaqti.uz) foydalanuvchi tuzatishlari bilan yopiladi.
 */

import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

import type { PrayerId } from './prayers';
import { addDays, addMinutes, isoDay, parseDay } from './time';

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

/** OpenStreetMap: Toʻraqoʻrgʻon shahri. Rasmiy roʻyxatda yoʻq, Namangandan ~0,5 daq farq. */
export const TORAQORGON: Place = {
  name: 'Toʻraqoʻrgʻon',
  latitude: 40.9991071,
  longitude: 71.5088649,
};

export const OFFICIAL_PARAMS = {
  fajrAngle: 15.5,
  ishaAngle: 15.5,
  shomAfterSunsetMinutes: 4,
} as const;

/** Foydalanuvchi tuzatishi qoʻllanadigan vaqtlar (daqiqa, ±) */
export const TIME_KEYS = ['bomdod', 'quyosh', 'peshin', 'asr', 'shom', 'xufton'] as const;
export type TimeKey = (typeof TIME_KEYS)[number];
export type Adjustments = Record<TimeKey, number>;

export const TIME_LABEL: Record<TimeKey, string> = {
  bomdod: 'Bomdod',
  quyosh: 'Quyosh',
  peshin: 'Peshin',
  asr: 'Asr',
  shom: 'Shom',
  xufton: 'Xufton',
};

export const NO_ADJUSTMENTS: Adjustments = {
  bomdod: 0,
  quyosh: 0,
  peshin: 0,
  asr: 0,
  shom: 0,
  xufton: 0,
};

export interface DayTimes {
  day: string;
  bomdod: Date;
  quyosh: Date;
  peshin: Date;
  asr: Date;
  /** Quyosh botishi — Asr oynasining oxiri. Tuzatish qoʻllanmaydi. */
  sunset: Date;
  shom: Date;
  xufton: Date;
}

function officialParams() {
  const params = CalculationMethod.Other();
  params.fajrAngle = OFFICIAL_PARAMS.fajrAngle;
  params.ishaAngle = OFFICIAL_PARAMS.ishaAngle;
  params.madhab = Madhab.Hanafi;
  return params;
}

export function computeDayTimes(day: string, place: Place, adj: Adjustments = NO_ADJUSTMENTS): DayTimes {
  // adhan sananing yil/oy/kunini mahalliy vaqt boʻyicha oladi — yarim tun yetarli
  const t = new PrayerTimes(new Coordinates(place.latitude, place.longitude), parseDay(day), officialParams());
  return {
    day,
    bomdod: addMinutes(t.fajr, adj.bomdod),
    quyosh: addMinutes(t.sunrise, adj.quyosh),
    peshin: addMinutes(t.dhuhr, adj.peshin),
    asr: addMinutes(t.asr, adj.asr),
    sunset: t.maghrib,
    shom: addMinutes(t.maghrib, OFFICIAL_PARAMS.shomAfterSunsetMinutes + adj.shom),
    xufton: addMinutes(t.isha, adj.xufton),
  };
}

/* ── Oynalar ──────────────────────────────────────────────────────────────── */

export interface PrayerWindow {
  prayer: PrayerId;
  /** Namoz kuni = Bomdod sanasi. Xufton va Vitr ertangi Bomdodgacha shu kunga tegishli. */
  day: string;
  start: Date;
  end: Date;
}

/**
 * Har bir namozning vaqti qachon kiradi va qachon chiqadi.
 *   Bomdod  → quyosh chiqishigacha
 *   Peshin  → Asr kirishigacha
 *   Asr     → quyosh botishigacha
 *   Shom    → Xufton kirishigacha
 *   Xufton, Vitr → ertangi Bomdodgacha
 */
export function windowsFor(today: DayTimes, tomorrow: DayTimes): Record<PrayerId, PrayerWindow> {
  const day = today.day;
  return {
    bomdod: { prayer: 'bomdod', day, start: today.bomdod, end: today.quyosh },
    peshin: { prayer: 'peshin', day, start: today.peshin, end: today.asr },
    asr: { prayer: 'asr', day, start: today.asr, end: today.sunset },
    shom: { prayer: 'shom', day, start: today.shom, end: today.xufton },
    xufton: { prayer: 'xufton', day, start: today.xufton, end: tomorrow.bomdod },
    vitr: { prayer: 'vitr', day, start: today.xufton, end: tomorrow.bomdod },
  };
}

/**
 * Hisoblangan vaqtlarni keshlaydigan manba. Ekranlar har soniya qayta chizilganda
 * bir xil kunni qayta-qayta hisoblamaslik uchun.
 */
export class PrayerCalendar {
  private cache = new Map<string, DayTimes>();

  constructor(
    readonly place: Place,
    readonly adjustments: Adjustments,
  ) {}

  times(day: string): DayTimes {
    let t = this.cache.get(day);
    if (!t) {
      t = computeDayTimes(day, this.place, this.adjustments);
      this.cache.set(day, t);
    }
    return t;
  }

  windows(day: string): Record<PrayerId, PrayerWindow> {
    return windowsFor(this.times(day), this.times(addDays(day, 1)));
  }

  /**
   * Hozir qaysi "namoz kuni" ichidamiz. Yarim tundan keyin, Bomdodgacha hali
   * kechagi kun davom etadi — Xufton va Vitr vaqti tugamagan.
   */
  prayerDayAt(now: Date): string {
    const today = isoDay(now);
    return now.getTime() < this.times(today).bomdod.getTime() ? addDays(today, -1) : today;
  }
}
