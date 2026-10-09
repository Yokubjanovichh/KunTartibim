import assert from 'node:assert/strict';

import { computeDayTimes, NO_ADJUSTMENTS, PrayerCalendar, TORAQORGON } from '../src/lib/prayer-times';
import { hhmm } from '../src/lib/time';
import { test } from './harness';

const fmt = (t: ReturnType<typeof computeDayTimes>) =>
  [t.bomdod, t.quyosh, t.peshin, t.asr, t.shom, t.xufton].map(hhmm).join(' ');

test('9-oktabr 2026: islom.uz formulasi bilan bir xil (05:01 06:19 12:01 15:59 17:47 19:01)', () => {
  // Qiymatlar 2026-10-09 da islom.uz parametrlari va adhan@4.4.3 bilan alohida hisoblangan
  assert.equal(fmt(computeDayTimes('2026-10-09', TORAQORGON)), '05:01 06:19 12:01 15:59 17:47 19:01');
});

test('Quyosh botishi Asr oxiri, Shom esa botishdan +4 daqiqa', () => {
  const t = computeDayTimes('2026-10-09', TORAQORGON);
  assert.equal(hhmm(t.sunset), '17:43');
  assert.equal((t.shom.getTime() - t.sunset.getTime()) / 60_000, 4);
});

test('Yoz va qish: vaqtlar 3 soatdan koʻp siljiydi', () => {
  const summer = computeDayTimes('2026-06-21', TORAQORGON);
  const winter = computeDayTimes('2026-12-21', TORAQORGON);
  assert.equal(hhmm(summer.bomdod), '02:57');
  assert.equal(hhmm(summer.xufton), '21:35');
  assert.equal(hhmm(winter.bomdod), '06:10');
  assert.equal(hhmm(winter.xufton), '18:14');
});

test('Tuzatishlar faqat oʻz vaqtiga taʼsir qiladi', () => {
  const t = computeDayTimes('2026-10-09', TORAQORGON, { ...NO_ADJUSTMENTS, peshin: 4, shom: -3 });
  assert.equal(hhmm(t.peshin), '12:05');
  assert.equal(hhmm(t.shom), '17:44');
  assert.equal(hhmm(t.sunset), '17:43', 'Asr oxiri (quyosh botishi) siljimasligi kerak');
  assert.equal(hhmm(t.asr), '15:59');
});

test('Namoz kuni: yarim tundan keyin Bomdodgacha kechagi kun davom etadi', () => {
  const cal = new PrayerCalendar(TORAQORGON, NO_ADJUSTMENTS);
  assert.equal(cal.prayerDayAt(new Date(2026, 9, 10, 0, 30)), '2026-10-09');
  assert.equal(cal.prayerDayAt(new Date(2026, 9, 10, 4, 59)), '2026-10-09');
  assert.equal(cal.prayerDayAt(new Date(2026, 9, 10, 5, 5)), '2026-10-10');
  assert.equal(cal.prayerDayAt(new Date(2026, 9, 9, 23, 59)), '2026-10-09');
});

test('Xufton va Vitr oynasi ertangi Bomdodda tugaydi', () => {
  const cal = new PrayerCalendar(TORAQORGON, NO_ADJUSTMENTS);
  const w = cal.windows('2026-10-09');
  const nextFajr = cal.times('2026-10-10').bomdod;
  assert.equal(w.xufton.end.getTime(), nextFajr.getTime());
  assert.equal(w.vitr.start.getTime(), w.xufton.start.getTime());
  assert.equal(w.asr.end.getTime(), cal.times('2026-10-09').sunset.getTime());
  assert.equal(w.bomdod.end.getTime(), cal.times('2026-10-09').quyosh.getTime());
});
