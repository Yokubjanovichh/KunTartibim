/**
 * Baza qatlami — ilovaning haqiqiy tracker.ts / planner-export.ts modullari, faqat
 * expo-sqlite oʻrnida Node SQLite (tests/shims). SQL xatolari telefonga yetmasdan
 * shu yerda ushlanadi.
 */
import assert from 'node:assert/strict';

import { getDb, getSetting, setSetting } from '../src/db/client';
import { SCHEMA_VERSION } from '../src/db/migrations';
import { decodeBase64Url } from '../src/lib/base64url';
import { buildPlannerPayload, markPlannerMoved, plannerDataCount, plannerImportUrl, plannerMovedAt } from '../src/lib/planner-export';
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
import { routerDecode } from './routerDecode';

function reset() {
  getDb().execSync(`
    DELETE FROM prayer_log; DELETE FROM qazo_entries; DELETE FROM tasks;
    DELETE FROM habit_log; DELETE FROM habits; DELETE FROM day_plans; DELETE FROM day_notes; DELETE FROM settings;
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

/* ── «Kun tartibim»ga koʻchirish ─────────────────────────────────────────── */

function seedPlanning() {
  const db = getDb();
  db.runSync(
    `INSERT INTO tasks (title, day, block, time, remind_before, priority, status, moved_count, created_at)
     VALUES ('Leetcode 2 masala', '2026-10-10', 'afternoon', '16:30', 15, 1, 'open', 1, '2026-10-09T17:00:00.000Z');`,
  );
  db.runSync(`INSERT INTO tasks (title, day, status, done_at, created_at) VALUES ('Zal', '2026-10-09', 'done', '2026-10-09T15:00:00.000Z', '2026-10-09T10:00:00.000Z');`);
  const habit = db.runSync(`INSERT INTO habits (title, kind, target_per_week, created_at) VALUES ('Kitob oʻqish', 'do', 7, '2026-10-09T09:00:00.000Z');`);
  db.runSync('INSERT INTO habit_log (habit_id, day, done, at) VALUES (?, ?, 1, ?);', [habit.lastInsertRowId, '2026-10-09', '2026-10-09T18:00:00.000Z']);
  db.runSync(`INSERT INTO day_plans (day, planned_at) VALUES ('2026-10-10', '2026-10-09T19:00:00.000Z');`);
  db.runSync(`INSERT INTO day_notes (day, text, updated_at) VALUES ('2026-10-09', 'Birinchi kun', '2026-10-09T19:00:00.000Z');`);
  setSetting('adjustments', JSON.stringify({ bomdod: 0, quyosh: 0, peshin: 4, asr: 0, shom: 0, xufton: -4 }));
  setSetting('bedtime', '23:30');
  setSetting('bedtime_enabled', '1');
}

test('Koʻchirish: ishlar, odatlar, belgilar, rejalar, xulosalar va sozlamalar — «Kun tartibim» kutgan shaklda', () => {
  reset();
  assert.equal(plannerDataCount(), 0);
  seedPlanning();
  assert.equal(plannerDataCount(), 5, '2 ish + 1 odat + 1 reja + 1 xulosa');

  const p = buildPlannerPayload(new Date('2026-10-10T16:00:00.000Z'));
  assert.equal(p.v, 1);
  assert.equal(p.exportedAt, '2026-10-10T16:00:00.000Z');
  // Maydon nomlari reja/src/lib/transfer.ts (TransferTask) bilan bir xil boʻlishi shart
  assert.deepEqual(Object.keys(p.tasks[0]).sort(), [
    'block', 'createdAt', 'day', 'doneAt', 'movedCount', 'priority', 'remindBefore', 'status', 'time', 'title',
  ]);
  assert.deepEqual(
    [p.tasks[0].title, p.tasks[0].block, p.tasks[0].time, p.tasks[0].remindBefore, p.tasks[0].priority, p.tasks[0].movedCount],
    ['Leetcode 2 masala', 'afternoon', '16:30', 15, 1, 1],
  );
  assert.equal(p.tasks[1].status, 'done');
  assert.deepEqual(Object.keys(p.habits[0]).sort(), ['archived', 'block', 'createdAt', 'id', 'kind', 'sortOrder', 'targetPerWeek', 'title']);
  assert.equal(p.habitLog[0].habitId, p.habits[0].id);
  assert.deepEqual(p.dayPlans, [{ day: '2026-10-10', plannedAt: '2026-10-09T19:00:00.000Z' }]);
  assert.equal(p.notes[0].text, 'Birinchi kun');
  assert.equal(p.settings.adjustments?.peshin, 4);
  assert.equal(p.settings.bedtime, '23:30');
  assert.equal(p.settings.bedtimeEnabled, true);
  assert.equal(p.settings.reviewTime, undefined, 'oʻzgartirilmagan sozlama yuborilmaydi');
});

test('Koʻchirish havolasi: telefondagidek (expo-router 3 marta decode) oʻqilganda ham buzilmaydi', () => {
  reset();
  seedPlanning();
  getDb().runSync(`INSERT INTO tasks (title, day, created_at) VALUES ('C++ & Java #1 — 100% "+"', '2026-10-11', '2026-10-10T08:00:00.000Z');`);
  const url = plannerImportUrl();
  assert.match(url, /^kunreja:\/\/import\?d=[A-Za-z0-9_-]+$/);
  const back = JSON.parse(decodeBase64Url(routerDecode(url)!));
  assert.equal(back.habits[0].title, 'Kitob oʻqish');
  assert.equal(back.tasks[2].title, 'C++ & Java #1 — 100% "+"');
  assert.ok(url.length < 100_000, `${url.length} belgi`);
});

test('Koʻchirildi belgisi: Bugun ekranidagi eslatma yashiriladi', () => {
  reset();
  assert.equal(plannerMovedAt(), null);
  markPlannerMoved(new Date('2026-10-10T16:05:00.000Z'));
  assert.equal(plannerMovedAt()?.toISOString(), '2026-10-10T16:05:00.000Z');
});
