import assert from 'node:assert/strict';

import { blockForTime, blockStart, currentBlock, momentOnPrayerDay } from '../src/lib/blocks';
import { habitMeta, type Habit, markKey, planningStreak, sleepHoursUntil, streak, weekProgress } from '../src/lib/habits';
import { computeDayTimes, TORAQORGON } from '../src/lib/prayer-times';
import { eveningAt, hhmm, isoDay } from '../src/lib/time';
import { test } from './harness';

const marks = (entries: [number, string, boolean][]) => new Map(entries.map(([id, d, v]) => [markKey(id, d), v]));

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 1,
  title: 'Kitob oʻqish',
  kind: 'do',
  targetPerWeek: 7,
  block: null,
  sortOrder: 0,
  archived: false,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

test('Seriya: bugun belgilanmagan boʻlsa — kechagidan sanaladi (kun hali tugamagan)', () => {
  const m = marks([
    [1, '2026-10-07', true],
    [1, '2026-10-08', true],
  ]);
  assert.equal(streak(1, m, '2026-10-09'), 2);
});

test('Seriya: bugun bajarilsa qoʻshiladi, oʻtkazilgan kun uzadi', () => {
  const m = marks([
    [1, '2026-10-05', true],
    [1, '2026-10-07', true],
    [1, '2026-10-08', true],
    [1, '2026-10-09', true],
  ]);
  assert.equal(streak(1, m, '2026-10-09'), 3);
});

test('Seriya: "bajarilmadi" (false) ham uzadi', () => {
  const m = marks([
    [1, '2026-10-07', true],
    [1, '2026-10-08', false],
  ]);
  assert.equal(streak(1, m, '2026-10-09'), 0);
});

test('Haftalik natija: dushanbadan bugungacha, boshqa odatlar aralashmaydi', () => {
  const m = marks([
    [2, '2026-10-04', true], // oʻtgan hafta yakshanba — kirmaydi
    [2, '2026-10-05', true],
    [2, '2026-10-07', false],
    [2, '2026-10-08', true],
    [3, '2026-10-08', true],
  ]);
  assert.deepEqual(weekProgress(2, m, '2026-10-05', '2026-10-09'), { done: 2, failed: 1 });
});

test('Izoh: kunlik odat — seriya, haftalik — "bu hafta 1/3"', () => {
  const m = marks([[1, '2026-10-08', true]]);
  assert.equal(habitMeta(habit(), m, '2026-10-05', '2026-10-09'), '1 kun ketma-ket');
  assert.equal(habitMeta(habit({ targetPerWeek: 3 }), m, '2026-10-05', '2026-10-09'), 'bu hafta 1/3');
});

test('Reja seriyasi: bugun kechqurun ertangi kun rejalangan boʻlsa ertadan sanaladi', () => {
  const planned = new Set(['2026-10-08', '2026-10-09', '2026-10-10']);
  assert.equal(planningStreak(planned, '2026-10-09'), 3);
  // Bugun hali rejalanmagan — kechagi seriya saqlanadi
  assert.equal(planningStreak(new Set(['2026-10-08', '2026-10-09']), '2026-10-09'), 2);
  assert.equal(planningStreak(new Set(['2026-10-07']), '2026-10-09'), 0);
});

test('Uyqu soati: 0,5 ga yaxlitlanadi, manfiy boʻlmaydi', () => {
  assert.equal(sleepHoursUntil(new Date(2026, 9, 9, 23, 0), new Date(2026, 9, 10, 5, 2)), 6);
  assert.equal(sleepHoursUntil(new Date(2026, 9, 10, 0, 40), new Date(2026, 9, 10, 5, 2)), 4.5);
  assert.equal(sleepHoursUntil(new Date(2026, 9, 10, 6, 0), new Date(2026, 9, 10, 5, 2)), 0);
});

test('Kechki vaqt: 23:00 — oʻsha kun, 00:30 — ertasi kalendar kuni', () => {
  assert.equal(isoDay(eveningAt('2026-10-09', '23:00')), '2026-10-09');
  const late = eveningAt('2026-10-09', '00:30');
  assert.equal(isoDay(late), '2026-10-10');
  assert.equal(hhmm(late), '00:30');
});

test('Bloklar: Asrdan keyin — Asr vaqtidan; tushda joriy blok "Peshindan keyin"', () => {
  const t = computeDayTimes('2026-10-09', TORAQORGON);
  assert.equal(hhmm(blockStart(t, 'afternoon')), '15:59');
  assert.equal(currentBlock(t, new Date(2026, 9, 9, 13, 0)), 'noon');
  assert.equal(currentBlock(t, new Date(2026, 9, 9, 4, 0)), null);
  assert.equal(currentBlock(t, new Date(2026, 9, 9, 20, 0)), 'night');
});

test('Vaqt → blok: 14:00 Peshindan keyin, 06:00 Bomdoddan keyin, 01:00 tun (ertasi sana)', () => {
  const t = computeDayTimes('2026-10-09', TORAQORGON);
  assert.equal(blockForTime(t, '2026-10-09', '14:00'), 'noon');
  assert.equal(blockForTime(t, '2026-10-09', '06:00'), 'morning');
  assert.equal(blockForTime(t, '2026-10-09', '16:30'), 'afternoon');
  assert.equal(blockForTime(t, '2026-10-09', '18:00'), 'evening');
  assert.equal(blockForTime(t, '2026-10-09', '01:00'), 'night');
  const late = momentOnPrayerDay(t, '2026-10-09', '01:00');
  assert.equal(isoDay(late), '2026-10-10', 'yarim tundan keyin — ertasi kalendar kuni');
  assert.equal(isoDay(momentOnPrayerDay(t, '2026-10-09', '23:00')), '2026-10-09');
});
