/**
 * Baza qatlami — ilovaning haqiqiy tracker.ts / plan.ts modullari, faqat
 * expo-sqlite oʻrnida Node SQLite (tests/shims). SQL xatolari telefonga yetmasdan
 * shu yerda ushlanadi.
 */
import assert from 'node:assert/strict';

import { getDb, getSetting, setSetting } from '../src/db/client';
import { SCHEMA_VERSION } from '../src/db/migrations';
import { markKey } from '../src/lib/habits';
import {
  addHabit,
  addTask,
  archiveHabit,
  backlogTasks,
  blockTaskTitles,
  habitMarks,
  isTaskOpen,
  listHabits,
  markPlanned,
  MAX_PRIORITY,
  moveTasks,
  overdueTasks,
  plannedDays,
  priorityTitlesByDay,
  setHabitMark,
  setTaskDone,
  taskReminders,
  tasksForDay,
  updateTask,
} from '../src/lib/plan';
import {
  addOldQazo,
  deleteEntry,
  makeup,
  makeupDays,
  markPrayer,
  qazoBalances,
  recentEntries,
  reconcile,
} from '../src/lib/tracker';
import { test } from './harness';

function reset() {
  getDb().execSync(`
    DELETE FROM prayer_log; DELETE FROM qazo_entries; DELETE FROM tasks;
    DELETE FROM habit_log; DELETE FROM habits; DELETE FROM day_plans; DELETE FROM settings;
  `);
  // Ilova 9-oktabr soat 11:00 da oʻrnatilgan
  setSetting('tracking_start', new Date(2026, 9, 9, 11, 0).toISOString());
}

test('Migratsiya: sxema oxirgi versiyada, hamma jadvallar bor', () => {
  const db = getDb();
  assert.equal(db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version, SCHEMA_VERSION);
  const tables = db.getAllSync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table';`).map((r) => r.name);
  for (const t of ['settings', 'prayer_log', 'qazo_entries', 'day_notes', 'handled_responses', 'habits', 'habit_log', 'tasks', 'day_plans']) {
    assert.ok(tables.includes(t), `${t} jadvali yoʻq`);
  }
});

test('reconcile: vaqti chiqqan belgilanmagan namoz — qazo; oʻrnatishdan oldingisi — yoʻq', () => {
  reset();
  markPrayer('2026-10-09', 'peshin', 'prayed');
  // 9-okt: Bomdod oʻrnatishdan oldin, Peshin ✓, Asr/Shom/Xufton/Vitr → qazo; 10-okt Bomdod → qazo
  assert.equal(reconcile(new Date(2026, 9, 10, 7, 0)), 5);
  const b = qazoBalances();
  assert.equal(b.total, 5);
  assert.equal(b.bomdod, 1);
  assert.equal(b.peshin, 0);
  assert.equal(reconcile(new Date(2026, 9, 10, 7, 30)), 0, 'qayta chaqirish hech narsa qoʻshmasin');
  assert.equal(getSetting('reconciled_through'), '2026-10-09');
});

test('Qazo: "aslida oʻqigandim" — allaqachon ayirilgan boʻlsa tuzatish, keyingi qazo yashirinmaydi', () => {
  reset();
  markPrayer('2026-10-09', 'asr', 'qazo');
  assert.equal(makeup('asr', 1), 1);
  markPrayer('2026-10-09', 'asr', 'prayed');
  assert.equal(qazoBalances().asr, 0);
  markPrayer('2026-10-10', 'asr', 'qazo');
  assert.equal(qazoBalances().asr, 1);
});

test('Qazo: eski qazo bekor qilinsa (oʻqib boʻlingan boʻlsa ham) keyingi qazo yashirinmaydi', () => {
  reset();
  addOldQazo({ bomdod: 5 });
  assert.equal(makeup('bomdod', 5), 5);
  deleteEntry(recentEntries().find((e) => e.kind === 'old')!.id);
  assert.equal(qazoBalances().bomdod, 0);
  markPrayer('2026-10-10', 'bomdod', 'qazo');
  assert.equal(qazoBalances().bomdod, 1);
});

test('Qazo: ayirish qoldiqdan oshmaydi; "1 kunlik" faqat qoldigʻi borlardan', () => {
  reset();
  addOldQazo({ bomdod: 2, peshin: 1 });
  assert.equal(makeup('asr', 1), 0);
  assert.equal(makeupDays(1), 2);
  const b = qazoBalances();
  assert.deepEqual([b.bomdod, b.peshin, b.total], [1, 0, 1]);
});

test('Vazifalar: asosiylar 3 tadan oshmaydi; tartib — asosiy, ochiq, bajarilgan', () => {
  reset();
  for (let i = 1; i <= 4; i++) addTask({ title: `Ish ${i}`, day: '2026-10-10', priority: true });
  setTaskDone(addTask({ title: 'Oddiy', day: '2026-10-10' }), true);
  const list = tasksForDay('2026-10-10');
  assert.equal(list.filter((t) => t.priority === 1).length, MAX_PRIORITY);
  assert.equal(list[list.length - 1].title, 'Oddiy');
});

test('Vazifalar: koʻchirish sanaladi; kechagi ochiq ishlar "qolib ketgan"', () => {
  reset();
  const id = addTask({ title: 'Leetcode 2 masala', day: '2026-10-08' });
  setTaskDone(addTask({ title: 'Bajarilgan', day: '2026-10-08' }), true);
  assert.deepEqual(overdueTasks('2026-10-09').map((t) => t.title), ['Leetcode 2 masala']);
  moveTasks([id], '2026-10-09');
  moveTasks([id], '2026-10-10');
  assert.equal(tasksForDay('2026-10-10')[0].movedCount, 2);
  assert.equal(overdueTasks('2026-10-09').length, 0);
});

test('Vazifalar: "keyinroq" roʻyxati asosiy boʻlmaydi, undan olish koʻchirish emas', () => {
  reset();
  const id = addTask({ title: 'CV yangilash', day: null, priority: true });
  assert.equal(backlogTasks()[0].priority, 0);
  moveTasks([id], '2026-10-10');
  assert.equal(backlogTasks().length, 0);
  assert.equal(tasksForDay('2026-10-10')[0].movedCount, 0);
});

test('Vazifalar: Bomdod eslatmasi uchun — faqat ochiq asosiylar', () => {
  reset();
  addTask({ title: 'CV', day: '2026-10-10', priority: true });
  addTask({ title: 'Zal', day: '2026-10-10', priority: true });
  setTaskDone(addTask({ title: 'Eski', day: '2026-10-10', priority: true }), true);
  addTask({ title: 'Oddiy', day: '2026-10-10' });
  assert.deepEqual(priorityTitlesByDay('2026-10-09', '2026-10-11').get('2026-10-10'), ['CV', 'Zal']);
});

test('Vazifa tahriri: kun oldinga — koʻchirish +1; toʻla kunda asosiy boʻlmaydi', () => {
  reset();
  for (let i = 1; i <= 3; i++) addTask({ title: `A${i}`, day: '2026-10-11', priority: true });
  const id = addTask({ title: 'B', day: '2026-10-10', priority: true });
  updateTask(id, { day: '2026-10-11' });
  const b = tasksForDay('2026-10-11').find((t) => t.title === 'B')!;
  assert.equal(b.movedCount, 1);
  assert.equal(b.priority, 0);
});

test('Odatlar: belgilar, olib tashlash, arxiv', () => {
  reset();
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
  reset();
  markPlanned('2026-10-10');
  markPlanned('2026-10-10');
  assert.deepEqual([...plannedDays('2026-10-01', '2026-10-31')], ['2026-10-10']);
});

test('Vaqtli ish: eslatmalar roʻyxati, blok nomlari, "keyinroq"ga olinsa vaqt oʻchadi', () => {
  reset();
  const a = addTask({ title: 'Interview', day: '2026-10-10', block: 'noon', time: '15:00', remindBefore: 60 });
  addTask({ title: 'Eslatmasiz', day: '2026-10-10', block: 'noon', time: '13:00', remindBefore: null });
  addTask({ title: 'Notoʻgʻri vaqt', day: '2026-10-10', time: '25:99', remindBefore: 0 });
  addTask({ title: 'Sanasiz', day: null, time: '10:00', remindBefore: 0 });
  assert.deepEqual(taskReminders('2026-10-09', '2026-10-11').map((t) => [t.title, t.time, t.remindBefore]), [['Interview', '15:00', 60]]);
  assert.equal(tasksForDay('2026-10-10').find((t) => t.title === 'Notoʻgʻri vaqt')!.time, null);
  assert.equal(backlogTasks()[0].time, null);
  // Blok ichida vaqt boʻyicha: 13:00, keyin 15:00
  assert.deepEqual(blockTaskTitles('2026-10-10', '2026-10-10').get('2026-10-10:noon'), ['Eslatmasiz (13:00)', 'Interview (15:00)']);
  moveTasks([a], null);
  const back = backlogTasks().find((t) => t.title === 'Interview')!;
  assert.equal(back.time, null);
  assert.equal(back.remindBefore, null);
  assert.ok(!isTaskOpen(999));
  assert.ok(isTaskOpen(a));
});
