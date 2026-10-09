/**
 * Vazifalar, odatlar va kechki reja — bazaga yozadigan yagona joy.
 *
 * Kun = namoz kuni (Bomdoddan Bomdodgacha), xuddi namozlardagidek. Kech yotadigan
 * foydalanuvchi soat 01:00 da "bugun" desa, hali tugamagan kunni nazarda tutadi —
 * kun Bomdodda almashadi, yarim tunda emas.
 */

import { getDb } from '../db/client';
import { type BlockId, isBlockId } from './blocks';
import { emitChange } from './events';
import { type Habit, type HabitKind, markKey } from './habits';

/* ── Vazifalar ────────────────────────────────────────────────────────────── */

export type TaskStatus = 'open' | 'done' | 'dropped';

export interface Task {
  id: number;
  title: string;
  /** null — sanasiz ("keyinroq" roʻyxati) */
  day: string | null;
  block: BlockId | null;
  priority: number;
  status: TaskStatus;
  doneAt: string | null;
  movedCount: number;
  createdAt: string;
}

/** Bir kunda koʻpi bilan shuncha "asosiy" ish — hammasi asosiy boʻlsa, hech biri asosiy emas */
export const MAX_PRIORITY = 3;

const TASK_COLUMNS = `id, title, day, block, priority, status, done_at AS doneAt,
  moved_count AS movedCount, created_at AS createdAt`;

function normalize(t: Task): Task {
  return { ...t, block: isBlockId(t.block) ? t.block : null };
}

const ORDER = `ORDER BY priority DESC, status = 'done', id`;

export function tasksForDay(day: string): Task[] {
  return getDb()
    .getAllSync<Task>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE day = ? AND status != 'dropped' ${ORDER};`, [day])
    .map(normalize);
}

/** Oldingi kunlardan qolib ketgan ochiq ishlar */
export function overdueTasks(beforeDay: string): Task[] {
  return getDb()
    .getAllSync<Task>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE day < ? AND status = 'open' ORDER BY day, id;`, [
      beforeDay,
    ])
    .map(normalize);
}

export function backlogTasks(): Task[] {
  return getDb()
    .getAllSync<Task>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE day IS NULL AND status = 'open' ORDER BY id;`)
    .map(normalize);
}

export function tasksInRange(fromDay: string, toDay: string): Task[] {
  return getDb()
    .getAllSync<Task>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE day BETWEEN ? AND ? AND status != 'dropped';`, [
      fromDay,
      toDay,
    ])
    .map(normalize);
}

export function getTask(id: number): Task | null {
  const t = getDb().getFirstSync<Task>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?;`, [id]);
  return t ? normalize(t) : null;
}

export function priorityCount(day: string, exceptId?: number): number {
  const row = getDb().getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tasks WHERE day = ? AND priority = 1 AND status != 'dropped' AND id != ?;`,
    [day, exceptId ?? -1],
  );
  return row?.n ?? 0;
}

export function addTask(input: { title: string; day: string | null; block?: BlockId | null; priority?: boolean }): number {
  const title = input.title.trim();
  if (!title) return 0;
  // Limitdan oshsa, ish oddiy boʻlib qoʻshiladi — foydalanuvchi tanlovini yoʻqotmaymiz
  const priority = input.priority && input.day && priorityCount(input.day) < MAX_PRIORITY ? 1 : 0;
  const res = getDb().runSync(
    'INSERT INTO tasks (title, day, block, priority, created_at) VALUES (?, ?, ?, ?, ?);',
    [title, input.day, input.block ?? null, priority, new Date().toISOString()],
  );
  emitChange();
  return Number(res.lastInsertRowId);
}

export function updateTask(id: number, patch: { title?: string; day?: string | null; block?: BlockId | null; priority?: boolean }): void {
  const cur = getTask(id);
  if (!cur) return;
  const day = patch.day !== undefined ? patch.day : cur.day;
  const wantsPriority = patch.priority !== undefined ? patch.priority : cur.priority === 1;
  const priority = wantsPriority && day && priorityCount(day, id) < MAX_PRIORITY ? 1 : 0;
  const moved = cur.day && day && day > cur.day ? 1 : 0;
  getDb().runSync('UPDATE tasks SET title = ?, day = ?, block = ?, priority = ?, moved_count = moved_count + ? WHERE id = ?;', [
    (patch.title ?? cur.title).trim() || cur.title,
    day,
    patch.block !== undefined ? patch.block : cur.block,
    priority,
    moved,
    id,
  ]);
  emitChange();
}

export function setTaskDone(id: number, done: boolean): void {
  getDb().runSync('UPDATE tasks SET status = ?, done_at = ? WHERE id = ?;', [
    done ? 'done' : 'open',
    done ? new Date().toISOString() : null,
    id,
  ]);
  emitChange();
}

/** Keyingi kunga (yoki boshqa kunga) koʻchirish — koʻchirishlar soni tahlilda koʻrinadi */
export function moveTasks(ids: number[], toDay: string | null): void {
  if (!ids.length) return;
  const db = getDb();
  db.withTransactionSync(() => {
    for (const id of ids) {
      db.runSync(
        `UPDATE tasks SET day = ?, moved_count = moved_count + CASE WHEN day IS NOT NULL THEN 1 ELSE 0 END,
           priority = CASE WHEN ? IS NULL THEN 0 ELSE priority END
         WHERE id = ?;`,
        [toDay, toDay, id],
      );
    }
    // Koʻchirilganlar orasida asosiy ishlar limitdan oshsa — ortiqchasi oddiy boʻladi
    if (toDay) {
      const extra = db.getAllSync<{ id: number }>(
        `SELECT id FROM tasks WHERE day = ? AND priority = 1 AND status != 'dropped' ORDER BY id LIMIT -1 OFFSET ?;`,
        [toDay, MAX_PRIORITY],
      );
      for (const e of extra) db.runSync('UPDATE tasks SET priority = 0 WHERE id = ?;', [e.id]);
    }
  });
  emitChange();
}

/** Bekor qilish — oʻchirmaydi, tahlilda "voz kechilgan" boʻlib qoladi */
export function dropTask(id: number): void {
  getDb().runSync(`UPDATE tasks SET status = 'dropped' WHERE id = ?;`, [id]);
  emitChange();
}

export function deleteTask(id: number): void {
  getDb().runSync('DELETE FROM tasks WHERE id = ?;', [id]);
  emitChange();
}

/** Kun → ochiq asosiy ishlar nomlari (Bomdod eslatmasi uchun) */
export function priorityTitlesByDay(fromDay: string, toDay: string): Map<string, string[]> {
  const rows = getDb().getAllSync<{ day: string; title: string }>(
    `SELECT day, title FROM tasks WHERE day BETWEEN ? AND ? AND priority = 1 AND status = 'open' ORDER BY id;`,
    [fromDay, toDay],
  );
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.day, [...(map.get(r.day) ?? []), r.title]);
  return map;
}

/* ── Odatlar ──────────────────────────────────────────────────────────────── */

type HabitRow = Omit<Habit, 'archived' | 'block'> & { archived: number; block: string | null };

const HABIT_COLUMNS = `id, title, kind, target_per_week AS targetPerWeek, block, sort_order AS sortOrder,
  archived, created_at AS createdAt`;

function toHabit(r: HabitRow): Habit {
  return {
    ...r,
    kind: r.kind === 'avoid' ? 'avoid' : 'do',
    targetPerWeek: Math.min(7, Math.max(1, r.targetPerWeek)),
    block: isBlockId(r.block) ? r.block : null,
    archived: r.archived === 1,
  };
}

export function listHabits(includeArchived = false): Habit[] {
  return getDb()
    .getAllSync<HabitRow>(
      `SELECT ${HABIT_COLUMNS} FROM habits ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY sort_order, id;`,
    )
    .map(toHabit);
}

export interface HabitInput {
  title: string;
  kind: HabitKind;
  targetPerWeek: number;
  block: BlockId | null;
}

export function addHabit(input: HabitInput): number {
  const title = input.title.trim();
  if (!title) return 0;
  const next = getDb().getFirstSync<{ n: number }>('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM habits;')?.n ?? 1;
  const res = getDb().runSync(
    'INSERT INTO habits (title, kind, target_per_week, block, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?);',
    [title, input.kind, Math.min(7, Math.max(1, input.targetPerWeek)), input.block, next, new Date().toISOString()],
  );
  emitChange();
  return Number(res.lastInsertRowId);
}

export function updateHabit(id: number, input: HabitInput): void {
  const title = input.title.trim();
  if (!title) return;
  getDb().runSync('UPDATE habits SET title = ?, kind = ?, target_per_week = ?, block = ? WHERE id = ?;', [
    title,
    input.kind,
    Math.min(7, Math.max(1, input.targetPerWeek)),
    input.block,
    id,
  ]);
  emitChange();
}

/** Arxivlash — tarix (seriyalar, tahlil) saqlanadi */
export function archiveHabit(id: number, archived = true): void {
  getDb().runSync('UPDATE habits SET archived = ? WHERE id = ?;', [archived ? 1 : 0, id]);
  emitChange();
}

export function habitMarks(fromDay: string, toDay: string): Map<string, boolean> {
  const rows = getDb().getAllSync<{ habitId: number; day: string; done: number }>(
    'SELECT habit_id AS habitId, day, done FROM habit_log WHERE day BETWEEN ? AND ?;',
    [fromDay, toDay],
  );
  const map = new Map<string, boolean>();
  for (const r of rows) map.set(markKey(r.habitId, r.day), r.done === 1);
  return map;
}

/** true — bajarildi/tiyildi, false — yoʻq, null — belgini olib tashlash */
export function setHabitMark(habitId: number, day: string, done: boolean | null): void {
  if (done === null) {
    getDb().runSync('DELETE FROM habit_log WHERE habit_id = ? AND day = ?;', [habitId, day]);
  } else {
    getDb().runSync(
      `INSERT INTO habit_log (habit_id, day, done, at) VALUES (?, ?, ?, ?)
       ON CONFLICT(habit_id, day) DO UPDATE SET done = excluded.done, at = excluded.at;`,
      [habitId, day, done ? 1 : 0, new Date().toISOString()],
    );
  }
  emitChange();
}

/* ── Kechki reja ──────────────────────────────────────────────────────────── */

/** "Reja tayyor" — `day` = rejalangan (ertangi) kun */
export function markPlanned(day: string): void {
  getDb().runSync('INSERT OR REPLACE INTO day_plans (day, planned_at) VALUES (?, ?);', [day, new Date().toISOString()]);
  emitChange();
}

export function plannedDays(fromDay: string, toDay: string): Set<string> {
  const rows = getDb().getAllSync<{ day: string }>('SELECT day FROM day_plans WHERE day BETWEEN ? AND ?;', [
    fromDay,
    toDay,
  ]);
  return new Set(rows.map((r) => r.day));
}
