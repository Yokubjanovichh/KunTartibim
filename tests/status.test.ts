import assert from 'node:assert/strict';

import { NO_ADJUSTMENTS, PrayerCalendar, TORAQORGON } from '../src/lib/prayer-times';
import { prayerKey } from '../src/lib/prayers';
import { canMark, deriveStatus, findMissed, nowInfo, rangeStats, type RecordStatus } from '../src/lib/status';
import { test } from './harness';

const cal = new PrayerCalendar(TORAQORGON, NO_ADJUSTMENTS);
const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m);
const installed = at(9, 11, 0); // ilova 9-oktabr soat 11:00 da oʻrnatilgan

test('Holatlar: upcoming → active → missed; yozuv har doim ustun', () => {
  const w = cal.windows('2026-10-09').peshin; // 12:01 – 15:59
  assert.equal(deriveStatus(w, undefined, at(9, 11, 30), installed), 'upcoming');
  assert.equal(deriveStatus(w, undefined, at(9, 13, 0), installed), 'active');
  assert.equal(deriveStatus(w, undefined, at(9, 16, 0), installed), 'missed');
  assert.equal(deriveStatus(w, 'prayed', at(9, 16, 0), installed), 'prayed');
  assert.equal(deriveStatus(w, 'qazo', at(9, 13, 0), installed), 'qazo');
});

test('Oʻrnatishdan oldin kirgan namoz qazoga yozilmaydi', () => {
  const bomdod = cal.windows('2026-10-09').bomdod; // 05:01 – 06:19, oʻrnatish 11:00
  assert.equal(deriveStatus(bomdod, undefined, at(9, 12, 0), installed), 'untracked');
});

test('Kelajakdagi namozni belgilab boʻlmaydi', () => {
  const asr = cal.windows('2026-10-09').asr;
  assert.equal(canMark(asr, at(9, 15, 0)), false);
  assert.equal(canMark(asr, at(9, 16, 0)), true);
});

test('findMissed: faqat vaqti chiqqan va belgilanmaganlar', () => {
  const records = new Map<string, RecordStatus>([[prayerKey('2026-10-09', 'peshin'), 'prayed']]);
  // 10-oktabr 07:00: 9-oktabrning hamma oynalari yopilgan, 10-ning Bomdodi ham
  const missed = findMissed(cal, '2026-10-09', at(10, 7, 0), installed, records);
  const keys = missed.map((m) => `${m.day}:${m.prayer}`);
  assert.deepEqual(keys, [
    '2026-10-09:asr',
    '2026-10-09:shom',
    '2026-10-09:xufton',
    '2026-10-09:vitr',
    '2026-10-10:bomdod',
  ]);
});

test('findMissed: Xufton tun boʻyi qazo boʻlmaydi — faqat Bomdod kirganda', () => {
  const missed = findMissed(cal, '2026-10-09', at(10, 2, 0), installed, new Map());
  assert.ok(!missed.some((m) => m.prayer === 'xufton' || m.prayer === 'vitr'));
});

test('nowInfo: tushda Peshin davom etyapti, keyingisi Asr', () => {
  const info = nowInfo(cal, at(9, 13, 0));
  assert.equal(info.current?.prayer, 'peshin');
  assert.equal(info.next.prayer, 'asr');
});

test('nowInfo: tunda Xufton davom etadi, keyingisi ertangi Bomdod', () => {
  const info = nowInfo(cal, at(10, 0, 30));
  assert.equal(info.current?.prayer, 'xufton');
  assert.equal(info.current?.day, '2026-10-09');
  assert.equal(info.next.prayer, 'bomdod');
  assert.equal(info.next.day, '2026-10-10');
});

test('nowInfo: quyosh chiqqach — hech qaysi namoz vaqti emas', () => {
  const info = nowInfo(cal, at(9, 9, 0));
  assert.equal(info.current, null);
  assert.equal(info.next.prayer, 'peshin');
});

test('rangeStats: oʻqilgan, qazo, davom etayotgan va kuzatuvdan oldingilar ajratiladi', () => {
  const records = new Map<string, RecordStatus>([
    [prayerKey('2026-10-09', 'peshin'), 'prayed'],
    [prayerKey('2026-10-09', 'asr'), 'qazo'],
    [prayerKey('2026-10-10', 'bomdod'), 'prayed'],
  ]);
  // 10-oktabr 13:00 — 9-oktabr: Bomdod kuzatuvdan oldin, Peshin ✓, Asr qazo,
  // Shom/Xufton/Vitr belgilanmagan → qazo; 10-oktabr: Bomdod ✓, Peshin davom etyapti
  const s = rangeStats(cal, '2026-10-09', '2026-10-10', records, at(10, 13, 0), installed);
  assert.equal(s.prayed, 2);
  assert.equal(s.qazo, 4);
  assert.equal(s.tracked, 6);
  assert.equal(s.pending, 1);
  assert.deepEqual(s.byPrayer.asr, { prayed: 0, qazo: 1 });
  assert.deepEqual(s.byPrayer.bomdod, { prayed: 1, qazo: 0 });
});
