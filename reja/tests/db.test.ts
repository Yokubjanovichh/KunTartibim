/**
 * Baza qatlami — ilovaning haqiqiy plan.ts / notes.ts modullari, faqat
 * expo-sqlite oʻrnida Node SQLite (tests/shims). SQL xatolari telefonga yetmasdan
 * shu yerda ushlanadi.
 */
import assert from 'node:assert/strict';

import { getDb } from '../src/db/client';
import { SCHEMA_VERSION } from '../src/db/migrations';
import { markKey } from '../src/lib/habits';
import { dayNotes, getDayNote, setDayNote } from '../src/lib/notes';
import {
  addHabit,
  addTask,
  archiveHabit,
  backlogTasks,
  dropTask,
  habitMarks,
  isTaskOpen,
  listHabits,
  markPlanned,
  MAX_PRIORITY,
  moveTasks,
  openTasksInRange,
  overdueTasks,
  plannedDays,
  setHabitMark,
  setTaskDone,
  tasksForDay,
  updateTask,
} from '../src/lib/plan';
import { claimResponse } from '../src/lib/responses';
import { test } from './harness';

export function resetDb() {
  getDb().execSync(`
    DELETE FROM tasks; DELETE FROM habit_log; DELETE FROM habits; DELETE FROM day_plans;
    DELETE FROM day_notes; DELETE FROM settings; DELETE FROM handled_responses;
  `);
}

test('Migratsiya: sxema oxirgi versiyada, hamma jadvallar bor', () => {
  const db = getDb();
  assert.equal(db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version, SCHEMA_VERSION);
  const tables = db.getAllSync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table';`).map((r) => r.name);
  for (const t of ['settings', 'tasks', 'habits', 'habit_log', 'day_plans', 'day_notes', 'handled_responses']) {
    assert.ok(tables.includes(t), `${t} jadvali yoʻq`);
  }
  // Namoz jadvallari bu ilovada yoʻq
  assert.ok(!tables.includes('prayer_log'));
});

test('Vazifalar: asosiylar 3 tadan oshmaydi; tartib — asosiy, ochiq, bajarilgan', () => {
  resetDb();
  for (let i = 1; i <= 4; i++) addTask({ title: `Ish ${i}`, day: '2026-10-10', priority: true });
  setTaskDone(addTask({ title: 'Oddiy', day: '2026-10-10' }), true);
  const list = tasksForDay('2026-10-10');
  assert.equal(list.filter((t) => t.priority === 1).length, MAX_PRIORITY);
  assert.equal(list[list.length - 1].title, 'Oddiy');
});

test('Vazifalar: koʻchirish sanaladi; kechagi ochiq ishlar "qolib ketgan"', () => {
  resetDb();
  const id = addTask({ title: 'Leetcode 2 masala', day: '2026-10-08' });
  setTaskDone(addTask({ title: 'Bajarilgan', day: '2026-10-08' }), true);
  assert.deepEqual(overdueTasks('2026-10-09').map((t) => t.title), ['Leetcode 2 masala']);
  moveTasks([id], '2026-10-09');
  moveTasks([id], '2026-10-10');
  assert.equal(tasksForDay('2026-10-10')[0].movedCount, 2);
  assert.equal(overdueTasks('2026-10-09').length, 0);
});

test('Vazifalar: "keyinroq" roʻyxati asosiy boʻlmaydi, undan olish koʻchirish emas', () => {
  resetDb();
  const id = addTask({ title: 'CV yangilash', day: null, priority: true });
  assert.equal(backlogTasks()[0].priority, 0);
  moveTasks([id], '2026-10-10');
  assert.equal(backlogTasks().length, 0);
  assert.equal(tasksForDay('2026-10-10')[0].movedCount, 0);
});

test('Vazifa tahriri: kun oldinga — koʻchirish +1; toʻla kunda asosiy boʻlmaydi', () => {
  resetDb();
  for (let i = 1; i <= 3; i++) addTask({ title: `A${i}`, day: '2026-10-11', priority: true });
  const id = addTask({ title: 'B', day: '2026-10-10', priority: true });
  updateTask(id, { day: '2026-10-11' });
  const b = tasksForDay('2026-10-11').find((t) => t.title === 'B')!;
  assert.equal(b.movedCount, 1);
  assert.equal(b.priority, 0);
});

test('Eslatma rejasi uchun: faqat ochiq ishlar, oraliq ichida', () => {
  resetDb();
  addTask({ title: 'Interview', day: '2026-10-10', block: 'noon', time: '15:00', remindBefore: 60 });
  setTaskDone(addTask({ title: 'Bajarilgan', day: '2026-10-10' }), true);
  dropTask(addTask({ title: 'Voz kechilgan', day: '2026-10-10' }));
  addTask({ title: 'Uzoqda', day: '2026-10-30' });
  addTask({ title: 'Sanasiz', day: null });
  const open = openTasksInRange('2026-10-09', '2026-10-20');
  assert.deepEqual(open.map((t) => [t.title, t.time, t.remindBefore, t.block]), [['Interview', '15:00', 60, 'noon']]);
});

test('Vaqtli ish: notoʻgʻri vaqt saqlanmaydi; "keyinroq"ga olinsa vaqt va eslatma oʻchadi', () => {
  resetDb();
  const a = addTask({ title: 'Interview', day: '2026-10-10', block: 'noon', time: '15:00', remindBefore: 60 });
  addTask({ title: 'Notoʻgʻri vaqt', day: '2026-10-10', time: '25:99', remindBefore: 0 });
  addTask({ title: 'Sanasiz', day: null, time: '10:00', remindBefore: 0 });
  assert.equal(tasksForDay('2026-10-10').find((t) => t.title === 'Notoʻgʻri vaqt')!.time, null);
  assert.equal(backlogTasks()[0].time, null);
  moveTasks([a], null);
  const back = backlogTasks().find((t) => t.title === 'Interview')!;
  assert.equal(back.time, null);
  assert.equal(back.remindBefore, null);
  assert.ok(!isTaskOpen(999));
  assert.ok(isTaskOpen(a));
});

test('Odatlar: belgilar, olib tashlash, arxiv', () => {
  resetDb();
  const kitob = addHabit({ title: 'Kitob oʻqish', kind: 'do', targetPerWeek: 7, block: null });
  const zal = addHabit({ title: 'Zal', kind: 'do', targetPerWeek: 3, block: 'afternoon' });
  setHabitMark(kitob, '2026-10-09', true);
  setHabitMark(kitob, '2026-10-10', false);
  setHabitMark(zal, '2026-10-10', true);
  setHabitMark(zal, '2026-10-10', null);
  const m = habitMarks('2026-10-01', '2026-10-31');
  assert.equal(m.get(markKey(kitob, '2026-10-09')), true);
  assert.equal(m.get(markKey(kitob, '2026-10-10')), false);
  assert.equal(m.has(markKey(zal, '2026-10-10')), false);
  assert.equal(listHabits().find((h) => h.id === zal)!.block, 'afternoon');
  archiveHabit(zal);
  assert.deepEqual(listHabits().map((h) => h.title), ['Kitob oʻqish']);
  assert.equal(listHabits(true).length, 2);
});

test('Kechki reja: qayta bosish xato bermaydi', () => {
  resetDb();
  markPlanned('2026-10-10');
  markPlanned('2026-10-10');
  assert.deepEqual([...plannedDays('2026-10-01', '2026-10-31')], ['2026-10-10']);
});

test('Xulosalar: saqlash, boʻsh matn oʻchiradi, hafta xulosasi kunlik roʻyxatga kirmaydi', () => {
  resetDb();
  setDayNote('2026-10-09', '  Yaxshi kun  ');
  setDayNote('week:2026-10-05', 'Hafta');
  assert.equal(getDayNote('2026-10-09'), 'Yaxshi kun');
  assert.deepEqual(dayNotes('2026-10-01', '2026-10-31').map((n) => n.day), ['2026-10-09']);
  setDayNote('2026-10-09', '   ');
  assert.equal(getDayNote('2026-10-09'), '');
});

test('Bildirishnoma javobi bir marta ishlaydi', () => {
  resetDb();
  assert.ok(claimResponse('task:1|task_done|123'));
  assert.ok(!claimResponse('task:1|task_done|123'));
});
