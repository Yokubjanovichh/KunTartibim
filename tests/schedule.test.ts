import assert from 'node:assert/strict';

import { NO_ADJUSTMENTS, PrayerCalendar, TORAQORGON } from '../src/lib/prayer-times';
import { prayerKey } from '../src/lib/prayers';
import { buildPlan, DEFAULT_PLAN_SETTINGS, type PlanInput, readData } from '../src/lib/schedule';
import type { RecordStatus } from '../src/lib/status';
import { hhmm } from '../src/lib/time';
import { test } from './harness';

const cal = new PrayerCalendar(TORAQORGON, NO_ADJUSTMENTS);

/**
 * Soat 04:00 — Bomdoddan oldin, demak "namoz kuni" hali 8-oktabr. Shuning uchun
 * reja 2 kunni qamraydi va 9-oktabrga tegishlilari alohida tekshiriladi.
 */
function plan(over: Partial<PlanInput> = {}) {
  return buildPlan({
    now: new Date(2026, 9, 9, 4, 0),
    horizonDays: 2,
    cal,
    records: new Map(),
    settings: DEFAULT_PLAN_SETTINGS,
    qazoTotal: 0,
    ...over,
  });
}

test('Bomdoddan oldin reja kechagi namoz kunidan boshlanadi', () => {
  const p = plan({ horizonDays: 1 });
  assert.ok(p.every((n) => n.data.day === '2026-10-08'));
  assert.ok(!p.some((n) => n.data.kind === 'start'), 'kechagi namozlarning vaqti allaqachon kirgan');
});

test('Bir kun: 5 ta start + 4 ta warn + uxlashdan oldingi tekshiruv = 10', () => {
  const p = plan().filter((n) => n.data.day === '2026-10-09');
  assert.equal(p.filter((n) => n.data.kind === 'start').length, 5);
  assert.equal(p.filter((n) => n.data.kind === 'warn').length, 4);
  assert.equal(p.filter((n) => n.data.kind === 'review').length, 1);
  assert.equal(p.length, 10);
});

test('Warn vaqti: oyna oxiridan 30 daqiqa oldin', () => {
  const warn = plan().find((n) => n.id === 'warn:2026-10-09:asr')!;
  assert.equal(hhmm(warn.at), '17:13'); // quyosh botishi 17:43
  assert.match(warn.body, /Quyosh botadi: 17:43/);
});

test('Belgilangan namozning eslatmalari rejaga kirmaydi', () => {
  const records = new Map<string, RecordStatus>([[prayerKey('2026-10-09', 'peshin'), 'prayed']]);
  const p = plan({ records, now: new Date(2026, 9, 9, 12, 30) });
  assert.ok(!p.some((n) => n.id.endsWith('2026-10-09:peshin')));
  assert.ok(p.some((n) => n.id === 'start:2026-10-09:asr'));
  assert.ok(p.some((n) => n.id === 'start:2026-10-10:peshin'), 'ertangi Peshin rejada qoladi');
});

test('Oʻtib ketgan vaqtga eslatma qoʻyilmaydi', () => {
  const p = plan({ now: new Date(2026, 9, 9, 13, 0) });
  assert.ok(!p.some((n) => n.id === 'start:2026-10-09:peshin'), 'Peshin allaqachon kirgan');
  assert.ok(p.some((n) => n.id === 'warn:2026-10-09:peshin'), 'lekin ogohlantirish hali oldinda');
  assert.ok(p.every((n) => n.at.getTime() > new Date(2026, 9, 9, 13, 0).getTime()));
});

test('Xufton: tugma toʻplami "isha", unga warn yoʻq', () => {
  const p = plan();
  assert.equal(p.find((n) => n.id === 'start:2026-10-09:xufton')?.category, 'isha');
  assert.ok(!p.some((n) => n.id === 'warn:2026-10-09:xufton'));
});

test('Uxlashdan oldin: sukut boʻyicha 22:30 («Kun tartibim» kun yakuni 22:00 da)', () => {
  const review = plan().find((n) => n.id === 'review:2026-10-09')!;
  assert.equal(hhmm(review.at), '22:30');
  assert.equal(review.category, 'review');
  assert.deepEqual(review.data.prayers, ['xufton', 'vitr']);
  assert.match(review.body, /^Xufton va Vitr belgilanmagan/);
});

test('Uxlashdan oldin: yozda Xuftondan kamida 30 daqiqa keyin keladi', () => {
  // 21-iyun Xufton 21:35 → 22:00 emas, 22:05
  const p = plan({ now: new Date(2026, 5, 21, 12, 0), settings: { ...DEFAULT_PLAN_SETTINGS, reviewTime: '22:00' } });
  const review = p.find((n) => n.data.kind === 'review')!;
  assert.equal(hhmm(review.at), '22:05');
});

test('Uxlashdan oldin: Xufton va Vitr belgilangan boʻlsa — kelmaydi; faqat Vitr qolsa — Vitr', () => {
  const both = new Map<string, RecordStatus>([
    [prayerKey('2026-10-09', 'xufton'), 'prayed'],
    [prayerKey('2026-10-09', 'vitr'), 'prayed'],
  ]);
  assert.ok(!plan({ records: both, now: new Date(2026, 9, 9, 20, 0) }).some((n) => n.id === 'review:2026-10-09'));
  const onlyVitr = new Map<string, RecordStatus>([[prayerKey('2026-10-09', 'xufton'), 'prayed']]);
  const r = plan({ records: onlyVitr, now: new Date(2026, 9, 9, 20, 0) }).find((n) => n.id === 'review:2026-10-09')!;
  assert.deepEqual(r.data.prayers, ['vitr']);
});

test('Qazo eslatmasi faqat qarz boʻlsa', () => {
  assert.ok(!plan({ qazoTotal: 0 }).some((n) => n.data.kind === 'qazo'));
  const q = plan({ qazoTotal: 12 }).find((n) => n.data.kind === 'qazo')!;
  assert.equal(hhmm(q.at), '20:30');
  assert.match(q.body, /12 ta/);
});

test('Oʻchirilgan eslatmalar → boʻsh reja', () => {
  assert.equal(plan({ settings: { ...DEFAULT_PLAN_SETTINGS, enabled: false } }).length, 0);
});

test('10 kunlik reja Android chegarasidan (500) ancha kam', () => {
  const p = plan({ horizonDays: 10, qazoTotal: 5 });
  assert.ok(p.length <= 120, `${p.length} ta`);
  assert.equal(new Set(p.map((n) => n.id)).size, p.length, 'identifikatorlar takrorlanmasin');
});

test('Xesh: kontent oʻzgarsa oʻzgaradi, aks holda barqaror', () => {
  const a = plan({ qazoTotal: 12 }).find((n) => n.data.kind === 'qazo')!;
  const b = plan({ qazoTotal: 12 }).find((n) => n.data.kind === 'qazo')!;
  const c = plan({ qazoTotal: 11 }).find((n) => n.data.kind === 'qazo')!;
  assert.equal(a.data.h, b.data.h);
  assert.notEqual(a.data.h, c.data.h);
});

/*
 * readData — bildirishnoma kontenti ikki xil shaklda keladi:
 *   · ilova ochiq (tinglovchi): JS `dataString` ni `data` obyektiga aylantirgan
 *   · ilova yopiq (fon vazifasi): XOM bundle — faqat `dataString` (JSON satr)
 * Avvalgi kod faqat birinchisini oʻqirdi va yopiq ilovada «Oʻqidim» ishlamasdi.
 */
test('readData: fon vazifasidagi xom kontent (faqat dataString)', () => {
  const raw = {
    title: 'Asr vaqti kirdi',
    body: '15:59 – 17:43',
    categoryIdentifier: 'prayer',
    dataString: JSON.stringify({ kind: 'start', day: '2026-10-09', prayers: ['asr'] }),
  };
  assert.deepEqual(readData(raw), { kind: 'start', day: '2026-10-09', prayers: ['asr'] });
});

test('readData: ochiq ilovadagi kontent (data obyekt)', () => {
  const mapped = { title: 'x', data: { kind: 'review', day: '2026-10-09', prayers: ['vitr'] } };
  assert.deepEqual(readData(mapped).prayers, ['vitr']);
});

test('readData: buzilgan yoki yoʻq maʼlumot — "unknown", hech narsa belgilanmaydi', () => {
  assert.equal(readData(undefined).kind, 'unknown');
  assert.equal(readData({ dataString: '{buzilgan' }).kind, 'unknown');
  assert.equal(readData({ data: null }).day, undefined);
});

test('Namoz eslatmasida ishlar yoʻq (ular «Kun tartibim»da): "Oʻqigach belgilang", Xuftonda Vitr', () => {
  const p = plan();
  assert.match(p.find((n) => n.id === 'start:2026-10-09:bomdod')!.body, /^05:01 – 06:19 · Oʻqigach belgilang$/);
  assert.match(p.find((n) => n.id === 'start:2026-10-09:xufton')!.body, /Vitrni ham unutmang$/);
  assert.ok(!p.some((n) => (n.data.kind as string) === 'sleep' || (n.data.kind as string) === 'task'));
});
