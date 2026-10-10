/**
 * Namozimdan koʻchirish. Namunaviy maʼlumot Namozim'dagi `planner-export.ts`
 * chiqaradigan shaklda (u yerdagi test maydon nomlarini tekshiradi).
 */
import assert from 'node:assert/strict';

import { getDb, getSetting, setSetting } from '../src/db/client';
import { markKey } from '../src/lib/habits';
import { getDayNote, setDayNote } from '../src/lib/notes';
import { habitMarks, listHabits, plannedDays, tasksForDay } from '../src/lib/plan';
import { applyTransfer, parseTransfer, transferSummary } from '../src/lib/transfer';
import { test } from './harness';

function reset() {
  getDb().execSync(`
    DELETE FROM tasks; DELETE FROM habit_log; DELETE FROM habits; DELETE FROM day_plans;
    DELETE FROM day_notes; DELETE FROM settings;
  `);
}

const sample = () => ({
  v: 1,
  exportedAt: '2026-10-10T16:00:00.000Z',
  tasks: [
    {
      title: 'Leetcode 2 masala',
      day: '2026-10-10',
      block: 'afternoon',
      time: '16:30',
      remindBefore: 15,
      priority: 1,
      status: 'open',
      doneAt: null,
      movedCount: 1,
      createdAt: '2026-10-09T17:00:00.000Z',
    },
    {
      title: 'CV yangilash',
      day: null,
      block: null,
      time: null,
      remindBefore: null,
      priority: 0,
      status: 'open',
      doneAt: null,
      movedCount: 0,
      createdAt: '2026-10-09T17:01:00.000Z',
    },
    {
      title: 'Zal',
      day: '2026-10-09',
      block: 'evening',
      time: null,
      remindBefore: null,
      priority: 0,
      status: 'done',
      doneAt: '2026-10-09T15:00:00.000Z',
      movedCount: 0,
      createdAt: '2026-10-09T10:00:00.000Z',
    },
  ],
  habits: [{ id: 7, title: 'Kitob oʻqish', kind: 'do', targetPerWeek: 7, block: null, sortOrder: 1, archived: 0, createdAt: '2026-10-09T09:00:00.000Z' }],
  habitLog: [{ habitId: 7, day: '2026-10-09', done: 1, at: '2026-10-09T18:00:00.000Z' }],
  dayPlans: [{ day: '2026-10-10', plannedAt: '2026-10-09T19:00:00.000Z' }],
  notes: [
    { day: '2026-10-09', text: 'Birinchi kun', updatedAt: '2026-10-09T19:00:00.000Z' },
    { day: 'week:2026-10-05', text: 'Hafta niyati', updatedAt: '2026-10-09T19:00:00.000Z' },
  ],
  settings: { adjustments: { bomdod: 0, quyosh: 0, peshin: 4, asr: 0, shom: 0, xufton: -4 }, reviewTime: '21:30', bedtimeEnabled: true, bedtime: '23:30' },
});

test('Koʻchirish: buzuq yoki notanish maʼlumot rad etiladi', () => {
  assert.equal(parseTransfer(undefined).ok, false);
  assert.equal(parseTransfer('{bu json emas').ok, false);
  assert.equal(parseTransfer(JSON.stringify({ v: 2 })).ok, false);
});

test('Koʻchirish: yozuvlar tozalanadi — notoʻgʻri boʻlak, sanasiz vaqt, notanish holat', () => {
  const r = parseTransfer(
    JSON.stringify({
      ...sample(),
      tasks: [
        { title: ' A ', day: '2026-10-10', block: 'tun', time: '10:00', remindBefore: 5, priority: 1, status: 'x', movedCount: -3, createdAt: 'yoʻq' },
        { title: 'B', day: null, time: '10:00', remindBefore: 5, priority: 1, status: 'open', createdAt: '2026-10-09T10:00:00.000Z' },
        { title: '   ', day: '2026-10-10' },
      ],
    }),
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  const [a, b] = r.payload.tasks;
  assert.equal(r.payload.tasks.length, 2, 'nomsiz ish tashlab yuboriladi');
  assert.deepEqual([a.title, a.block, a.time, a.remindBefore, a.status, a.movedCount], ['A', null, '10:00', 5, 'open', 0]);
  assert.ok(!Number.isNaN(Date.parse(a.createdAt)));
  assert.deepEqual([b.time, b.remindBefore, b.priority], [null, null, 0], 'sanasiz ishda vaqt va asosiylik yoʻq');
});

test('Koʻchirish: ishlar, odatlar (yangi id bilan), belgilar, reja, xulosalar va sozlamalar yoziladi', () => {
  reset();
  const r = parseTransfer(JSON.stringify(sample()));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(transferSummary(r.payload), '3 ta ish (2 tasi ochiq) · 1 ta odat · 2 ta xulosa · 1 kunlik reja belgisi');
  const res = applyTransfer(r.payload);
  assert.deepEqual(res, { tasks: 3, habits: 1, notes: 2, skipped: 0 });

  const t = tasksForDay('2026-10-10')[0];
  assert.deepEqual([t.title, t.block, t.time, t.remindBefore, t.priority, t.movedCount], ['Leetcode 2 masala', 'afternoon', '16:30', 15, 1, 1]);
  assert.equal(tasksForDay('2026-10-09')[0].status, 'done');

  const habit = listHabits()[0];
  assert.equal(habit.title, 'Kitob oʻqish');
  assert.equal(habitMarks('2026-10-01', '2026-10-31').get(markKey(habit.id, '2026-10-09')), true, 'belgi yangi id bilan bogʻlangan');
  assert.deepEqual([...plannedDays('2026-10-01', '2026-10-31')], ['2026-10-10']);
  assert.equal(getDayNote('week:2026-10-05'), 'Hafta niyati');

  assert.equal(JSON.parse(getSetting('adjustments')!).peshin, 4);
  assert.equal(getSetting('review_time'), '21:30');
  assert.equal(getSetting('bedtime'), '23:30');
  assert.ok(getSetting('imported_at'));
});

test('Koʻchirish: qayta bosilsa takrorlanmaydi; bu yerdagi xulosa va sozlama ustiga yozilmaydi', () => {
  reset();
  const r = parseTransfer(JSON.stringify(sample()));
  if (!r.ok) throw new Error(r.error);
  applyTransfer(r.payload);
  setDayNote('2026-10-09', 'Bu ilovada yozilgan');
  setSetting('review_time', '22:15');

  const again = applyTransfer(r.payload);
  assert.deepEqual(again, { tasks: 0, habits: 0, notes: 0, skipped: 3 });
  assert.equal(tasksForDay('2026-10-10').length, 1);
  assert.equal(listHabits().length, 1);
  assert.equal(getDayNote('2026-10-09'), 'Bu ilovada yozilgan');
  assert.equal(getSetting('review_time'), '22:15', 'ikkinchi koʻchirish eslatma vaqtini qaytarmaydi');
});
