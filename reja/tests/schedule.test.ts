import assert from 'node:assert/strict';

import { NO_ADJUSTMENTS, PrayerCalendar, TORAQORGON } from '../src/lib/prayer-times';
import {
  BLOCK_DELAY_MIN,
  buildPlan,
  contentHash,
  DEFAULT_PLAN_SETTINGS,
  MORNING_DELAY_MIN,
  type PlanInput,
  type PlanTask,
  readData,
} from '../src/lib/schedule';
import { addMinutes, hhmm } from '../src/lib/time';
import { test } from './harness';

const cal = new PrayerCalendar(TORAQORGON, NO_ADJUSTMENTS);
const DAY = '2026-10-10';
const times = cal.times(DAY);

let nextId = 1;
const task = (over: Partial<PlanTask> = {}): PlanTask => ({
  id: nextId++,
  title: 'Ish',
  day: DAY,
  block: null,
  time: null,
  remindBefore: null,
  priority: 0,
  ...over,
});

const plan = (over: Partial<PlanInput> = {}) =>
  buildPlan({
    // 10-oktabr tunda, Bomdoddan oldin — namoz kuni hali 9-oktabr
    now: new Date(2026, 9, 10, 2, 0),
    horizonDays: 2,
    cal,
    settings: DEFAULT_PLAN_SETTINGS,
    tasks: [],
    plannedDays: new Set(),
    ...over,
  });

const byId = (list: ReturnType<typeof buildPlan>, id: string) => list.find((n) => n.id === id);

test('Bugungi reja: Bomdoddan 30 daqiqa keyin, asosiylar ★ bilan, qolganlari soni', () => {
  const list = plan({
    tasks: [task({ title: 'CV', priority: 1 }), task({ title: 'Zal', priority: 1, block: 'afternoon' }), task({ title: 'Kitob' })],
  });
  const m = byId(list, `morning:${DAY}`)!;
  assert.equal(m.at.getTime(), addMinutes(times.bomdod, MORNING_DELAY_MIN).getTime());
  assert.equal(m.title, 'Bugungi reja');
  assert.equal(m.body, '★ CV, Zal · yana 1 ta ish');
  assert.equal(m.data.route, '/');
});

test('Bugungi reja: asosiy boʻlmasa — ishlar soni va roʻyxati (vaqtlilar avval)', () => {
  const list = plan({ tasks: [task({ title: 'Kitob' }), task({ title: 'Interview', time: '15:00', block: 'afternoon' })] });
  assert.equal(byId(list, `morning:${DAY}`)!.body, '2 ta ish: Interview (15:00), Kitob');
});

test('Ish yoʻq kun: ertalabki va boʻlak eslatmalari yoʻq, kun yakuni va yotish vaqti bor', () => {
  const list = plan();
  assert.ok(!list.some((n) => n.data.kind === 'morning' || n.data.kind === 'block'));
  assert.ok(byId(list, `review:${DAY}`));
  assert.ok(byId(list, `sleep:${DAY}`));
});

test('Boʻlak eslatmasi: namozdan 20 daqiqa keyin; ertalabki boʻlak "Bugungi reja" ichida', () => {
  const tasks = [task({ title: 'Zal', block: 'afternoon' }), task({ title: 'Ingliz tili', block: 'morning' })];
  const list = plan({ tasks });
  const b = byId(list, `block:${DAY}:afternoon`)!;
  assert.equal(b.title, 'Asrdan keyin');
  assert.equal(b.body, 'Zal');
  assert.equal(b.at.getTime(), addMinutes(times.asr, BLOCK_DELAY_MIN).getTime());
  assert.equal(byId(list, `block:${DAY}:morning`), undefined);
  // Ertalabki reja oʻchiq boʻlsa — ertalabki boʻlak oʻzi eslatiladi
  const off = plan({ tasks, settings: { ...DEFAULT_PLAN_SETTINGS, morningEnabled: false } });
  assert.equal(byId(off, `block:${DAY}:morning`)!.body, 'Ingliz tili');
  assert.equal(byId(off, `morning:${DAY}`), undefined);
  // Boʻlak eslatmalari oʻchiq — faqat ertalabki reja qoladi
  const noBlocks = plan({ tasks, settings: { ...DEFAULT_PLAN_SETTINGS, blockEnabled: false } });
  assert.ok(!noBlocks.some((n) => n.data.kind === 'block'));
  assert.ok(byId(noBlocks, `morning:${DAY}`));
});

test('Vaqti oʻtgan eslatmalar qoʻyilmaydi', () => {
  const tasks = [task({ title: 'Zal', block: 'afternoon' }), task({ title: 'CV', priority: 1 })];
  const list = plan({ tasks, now: addMinutes(times.asr, BLOCK_DELAY_MIN + 1) });
  assert.equal(byId(list, `morning:${DAY}`), undefined);
  assert.equal(byId(list, `block:${DAY}:afternoon`), undefined);
});

test('Vaqtli ish: N daqiqa oldin [Bajarildi ✓]; Bomdoddan oldingi soat — shu kunning tuni', () => {
  const a = task({ title: 'Interview', time: '15:00', remindBefore: 60, block: 'afternoon' });
  const b = task({ title: 'Tungi ish', time: '01:30', remindBefore: 0, block: 'night' });
  const c = task({ title: 'Eslatmasiz', time: '16:00', remindBefore: null });
  const list = plan({ tasks: [a, b, c] });
  const ra = byId(list, `task:${a.id}`)!;
  assert.equal(hhmm(ra.at), '14:00');
  assert.equal(ra.category, 'task');
  assert.equal(ra.body, '15:00 da · 1 soat qoldi');
  const rb = byId(list, `task:${b.id}`)!;
  assert.equal(rb.at.getDate(), 11, '01:30 — ertasi kalendar kuni');
  assert.equal(rb.body, 'Vaqti keldi · 01:30');
  assert.equal(byId(list, `task:${c.id}`), undefined);
});

test('Kun yakuni: Xuftondan kamida 30 daqiqa keyin; ochiq ishlar soni; reja tuzilgan boʻlsa qisqa', () => {
  const early = plan({ settings: { ...DEFAULT_PLAN_SETTINGS, reviewTime: '18:00' }, tasks: [task(), task()] });
  const r = byId(early, `review:${DAY}`)!;
  assert.equal(r.at.getTime(), addMinutes(times.xufton, 30).getTime());
  assert.equal(r.body, 'Kunni yoping va ertangi rejani tuzing — 2 daqiqa. Ochiq ishlar: 2 ta.');
  assert.equal(r.data.route, '/review');
  const planned = plan({ plannedDays: new Set(['2026-10-11']) });
  assert.equal(byId(planned, `review:${DAY}`)!.body, 'Bugungi kunni yoping — 1 daqiqa.');
  assert.match(byId(planned, `sleep:${DAY}`)!.body, /Reja tayyor\.$/);
});

test('Eslatmalar oʻchiq — reja boʻsh', () => {
  assert.equal(plan({ settings: { ...DEFAULT_PLAN_SETTINGS, enabled: false }, tasks: [task()] }).length, 0);
});

test('readData: fon vazifasidagi xom bundle (dataString) ham oʻqiladi', () => {
  assert.deepEqual(readData({ dataString: JSON.stringify({ kind: 'task', taskId: 5 }) }), { kind: 'task', taskId: 5 });
  assert.deepEqual(readData({ data: { kind: 'test' } }), { kind: 'test' });
  assert.equal(readData(null).kind, 'unknown');
});

test('Xesh: matn oʻzgarsa oʻzgaradi, aks holda barqaror', () => {
  const n = { id: 'x', at: new Date(2026, 9, 10, 9, 0), title: 'A', body: 'b', category: 'info' as const, data: { kind: 'block' as const } };
  assert.equal(contentHash(n), contentHash({ ...n }));
  assert.notEqual(contentHash(n), contentHash({ ...n, body: 'c' }));
});
