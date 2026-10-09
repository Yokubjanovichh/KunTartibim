import assert from 'node:assert/strict';

import { alarmConfigFrom, alarmTimeFor, buildAlarmPlan, DEFAULT_ALARM_SETTINGS } from '../src/lib/alarm-plan';
import { NO_ADJUSTMENTS, PrayerCalendar, TORAQORGON } from '../src/lib/prayer-times';
import { prayerKey } from '../src/lib/prayers';
import type { RecordStatus } from '../src/lib/status';
import { hhmm, isoDay } from '../src/lib/time';
import { test } from './harness';

const cal = new PrayerCalendar(TORAQORGON, NO_ADJUSTMENTS);

test('Budilnik: Bomdod kirganda; +N daqiqa; quyosh chiqishidan 20 daqiqa oldindan kech emas', () => {
  assert.equal(hhmm(alarmTimeFor(cal, '2026-10-10', 0)), '05:02');
  assert.equal(hhmm(alarmTimeFor(cal, '2026-10-10', 15)), '05:17');
  // Quyosh 06:20 → eng kechi 06:00
  assert.equal(hhmm(alarmTimeFor(cal, '2026-10-10', 90)), '06:00');
});

test('Budilnik rejasi: kechasi soat 02:00 da — bugungi Bomdoddan boshlanadi, har kun alohida', () => {
  const plan = buildAlarmPlan(cal, new Date(2026, 9, 10, 2, 0), 14, DEFAULT_ALARM_SETTINGS, new Map());
  assert.equal(isoDay(new Date(plan[0].at)), '2026-10-10');
  assert.equal(hhmm(new Date(plan[0].at)), '05:02');
  assert.equal(hhmm(new Date(plan[0].endAt)), '06:20');
  assert.equal(plan[0].body, '05:02 – 06:20');
  // Bomdod har kuni siljiydi — vaqtlar bir xil emas
  assert.notEqual(hhmm(new Date(plan[0].at)), hhmm(new Date(plan[10].at)));
  assert.ok(plan.length >= 14);
  assert.ok(plan.every((a, i) => i === 0 || a.at > plan[i - 1].at), 'tartiblangan');
});

test('Budilnik rejasi: Bomdod allaqachon belgilangan kun oʻtkazib yuboriladi; oʻchiq — boʻsh', () => {
  const records = new Map<string, RecordStatus>([[prayerKey('2026-10-10', 'bomdod'), 'prayed']]);
  const plan = buildAlarmPlan(cal, new Date(2026, 9, 10, 2, 0), 3, DEFAULT_ALARM_SETTINGS, records);
  assert.equal(isoDay(new Date(plan[0].at)), '2026-10-11');
  assert.equal(buildAlarmPlan(cal, new Date(2026, 9, 10, 2, 0), 3, { ...DEFAULT_ALARM_SETTINGS, alarmEnabled: false }, new Map()).length, 0);
});

test('Budilnik rejasi: vaqti oʻtgan bugungi budilnik qoʻyilmaydi', () => {
  const plan = buildAlarmPlan(cal, new Date(2026, 9, 10, 5, 30), 2, DEFAULT_ALARM_SETTINGS, new Map());
  assert.equal(isoDay(new Date(plan[0].at)), '2026-10-11');
});

test('Uygʻonish tekshiruvi sukut boʻyicha 15 daqiqa (tahoratga borib kelishga yetsin)', () => {
  const cfg = alarmConfigFrom(DEFAULT_ALARM_SETTINGS);
  assert.equal(cfg.checkDelayMinutes, 15);
  assert.equal(cfg.checkEnabled, true);
  assert.equal(cfg.maxSnoozes, 2);
  assert.equal(alarmConfigFrom({ ...DEFAULT_ALARM_SETTINGS, alarmCheckDelay: 20 }).checkDelayMinutes, 20);
});
