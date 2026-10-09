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

test('Bir kun: 5 ta start + 4 ta warn + kun yakuni + yotish vaqti = 11', () => {
  const p = plan().filter((n) => n.data.day === '2026-10-09');
  assert.equal(p.filter((n) => n.data.kind === 'start').length, 5);
  assert.equal(p.filter((n) => n.data.kind === 'warn').length, 4);
  assert.equal(p.filter((n) => n.data.kind === 'review').length, 1);
  assert.equal(p.filter((n) => n.data.kind === 'sleep').length, 1);
  assert.equal(p.length, 11);
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

test('Kun yakuni: yozda Xuftondan kamida 30 daqiqa keyin keladi', () => {
  // 21-iyun Xufton 21:35 → 22:00 emas, 22:05
  const p = plan({ now: new Date(2026, 5, 21, 12, 0) });
  const review = p.find((n) => n.data.kind === 'review')!;
  assert.equal(hhmm(review.at), '22:05');
});

test('Kun yakuni: Xufton va Vitr belgilangan boʻlsa — tugmasiz', () => {
  const records = new Map<string, RecordStatus>([
    [prayerKey('2026-10-09', 'xufton'), 'prayed'],
    [prayerKey('2026-10-09', 'vitr'), 'prayed'],
  ]);
  const review = plan({ records, now: new Date(2026, 9, 9, 20, 0) }).find((n) => n.data.kind === 'review')!;
  assert.equal(review.category, 'info');
  assert.deepEqual(review.data.prayers, []);
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

test('Bomdod eslatmasida kunning asosiy ishi koʻrinadi', () => {
  const topTasks = new Map([['2026-10-09', ['CV yangilash', 'Zal']]]);
  const bomdod = plan({ topTasks }).find((n) => n.id === 'start:2026-10-09:bomdod')!;
  assert.match(bomdod.body, /Bugun asosiy: CV yangilash, Zal/);
  // Boshqa namozlarda koʻrsatilmaydi
  const peshin = plan({ topTasks }).find((n) => n.id === 'start:2026-10-09:peshin')!;
  assert.doesNotMatch(peshin.body, /asosiy/);
});

test('Yotish vaqti: 23:00, ertangi Bomdodgacha uyqu soati va reja holati', () => {
  const sleep = plan().find((n) => n.id === 'sleep:2026-10-09')!;
  assert.equal(hhmm(sleep.at), '23:00');
  assert.match(sleep.body, /Ertangi Bomdod 05:02 da — hozir yotsangiz 6 soat uxlaysiz/);
  assert.match(sleep.body, /reja hali tuzilmagan/);
  assert.equal(sleep.data.route, '/review');

  const planned = plan({ plannedDays: new Set(['2026-10-10']) }).find((n) => n.id === 'sleep:2026-10-09')!;
  assert.match(planned.body, /Reja tayyor/);
  assert.equal(planned.data.route, undefined);
});

test('Yotish vaqti yarim tundan keyin (00:30) — ertasi kalendar kunida', () => {
  const s = plan({ settings: { ...DEFAULT_PLAN_SETTINGS, bedtime: '00:30' } }).find((n) => n.id === 'sleep:2026-10-09')!;
  assert.equal(s.at.getDate(), 10);
  assert.equal(hhmm(s.at), '00:30');
  assert.match(s.body, /4,5 soat/);
});

test('Kun yakuni ertangi reja tuzilmagan boʻlsa shuni soʻraydi', () => {
  const r = plan().find((n) => n.id === 'review:2026-10-09')!;
  assert.match(r.body, /ertangi rejani tuzing/);
  const done = plan({ plannedDays: new Set(['2026-10-10']) }).find((n) => n.id === 'review:2026-10-09')!;
  assert.doesNotMatch(done.body, /ertangi rejani/);
});

test('Vaqtli ish: eslatma "N daqiqa oldin", oʻtgan vaqtga qoʻyilmaydi', () => {
  const taskReminders = [
    { id: 7, title: 'Interview', day: '2026-10-09', time: '15:00', remindBefore: 60 },
    { id: 8, title: 'Qoʻngʻiroq', day: '2026-10-09', time: '03:30', remindBefore: 0 }, // tun → 10-okt 03:30
    { id: 9, title: 'Oʻtib ketgan', day: '2026-10-08', time: '10:00', remindBefore: 0 },
  ];
  const p = plan({ taskReminders });
  const a = p.find((n) => n.id === 'task:7')!;
  assert.equal(hhmm(a.at), '14:00');
  assert.equal(a.category, 'task');
  assert.equal(a.data.taskId, 7);
  assert.match(a.body, /15:00 da · 1 soat qoldi/);
  const b = p.find((n) => n.id === 'task:8')!;
  assert.equal(b.at.getDate(), 10, 'namoz kunining tuni — ertasi sana');
  assert.match(b.body, /Vaqti keldi · 03:30/);
  assert.ok(!p.some((n) => n.id === 'task:9'));
});

test('Namoz eslatmasi oʻsha blok ishlarini aytadi: "Asr vaqti kirdi · Keyin: …"', () => {
  const blockTasks = new Map([
    ['2026-10-09:afternoon', ['Leetcode 2 masala', 'CV (16:30)']],
    ['2026-10-09:night', ['Kitob']],
  ]);
  const p = plan({ blockTasks });
  assert.match(p.find((n) => n.id === 'start:2026-10-09:asr')!.body, /Keyin: Leetcode 2 masala, CV \(16:30\)/);
  assert.match(p.find((n) => n.id === 'start:2026-10-09:xufton')!.body, /Vitrni unutmang · Keyin: Kitob/);
  assert.doesNotMatch(p.find((n) => n.id === 'start:2026-10-09:peshin')!.body, /Keyin/);
});
