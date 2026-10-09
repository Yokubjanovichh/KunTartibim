/**
 * Namoz kuzatuvi va qazo hisobi — bazaga yozadigan yagona joy.
 *
 * Qazo qoldigʻi alohida ustunda saqlanmaydi, har safar hisoblanadi:
 *   qoldiq = 'qazo' yozuvlari soni + SUM(qazo_entries.delta)
 * Shunda tarix bilan qoldiq hech qachon ajralib qolmaydi.
 */

import { getDb, getSetting, setSetting } from '../db/client';
import { emitChange } from './events';
import { PrayerCalendar, TORAQORGON } from './prayer-times';
import { PRAYERS, type PrayerId, isPrayerId, prayerKey } from './prayers';
import { type AppSettings, loadSettings } from './settings';
import { findMissed, type RecordStatus } from './status';
import { addDays, isoDay } from './time';

export type MarkSource = 'app' | 'notification' | 'auto' | 'review';

/* ── Taqvim ───────────────────────────────────────────────────────────────── */

let calCache: { key: string; cal: PrayerCalendar } | null = null;

/** Sozlamalardagi tuzatishlar bilan taqvim. Tuzatish oʻzgarsa — yangisi. */
export function calendarFor(settings: Pick<AppSettings, 'adjustments'> = loadSettings()): PrayerCalendar {
  const key = JSON.stringify(settings.adjustments);
  if (!calCache || calCache.key !== key) {
    calCache = { key, cal: new PrayerCalendar(TORAQORGON, settings.adjustments) };
  }
  return calCache.cal;
}

/* ── Yozuvlar ─────────────────────────────────────────────────────────────── */

export interface LogRow {
  day: string;
  prayer: PrayerId;
  status: RecordStatus;
  source: MarkSource;
  markedAt: string;
}

export function getLogRows(fromDay: string, toDay: string): LogRow[] {
  return getDb()
    .getAllSync<LogRow>(
      `SELECT day, prayer, status, source, marked_at AS markedAt
         FROM prayer_log WHERE day BETWEEN ? AND ? ORDER BY day;`,
      [fromDay, toDay],
    )
    .filter((r) => isPrayerId(r.prayer));
}

export function getRecords(fromDay: string, toDay: string): Map<string, RecordStatus> {
  const map = new Map<string, RecordStatus>();
  for (const r of getLogRows(fromDay, toDay)) map.set(prayerKey(r.day, r.prayer), r.status);
  return map;
}

function rawBalance(prayer: PrayerId): number {
  const row = getDb().getFirstSync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM prayer_log WHERE prayer = ? AND status = 'qazo')
          + (SELECT COALESCE(SUM(delta), 0) FROM qazo_entries WHERE prayer = ?) AS n;`,
    [prayer, prayer],
  );
  return row?.n ?? 0;
}

function addEntry(prayer: PrayerId, delta: number, kind: 'old' | 'makeup' | 'correction'): void {
  getDb().runSync('INSERT INTO qazo_entries (prayer, delta, kind, created_at) VALUES (?, ?, ?, ?);', [
    prayer,
    delta,
    kind,
    new Date().toISOString(),
  ]);
}

/**
 * Namozni belgilash. Qazo → oʻqildi tuzatilganda, agar oʻsha qazo allaqachon
 * "qazosi oʻqildi" deb ayirilgan boʻlsa, qoldiq manfiyga tushadi va keyingi
 * haqiqiy qazoni yashirib qoʻyardi — tuzatish yozuvi buni toʻgʻrilaydi.
 */
export function markPrayer(day: string, prayer: PrayerId, status: RecordStatus, source: MarkSource = 'app'): void {
  const db = getDb();
  db.withTransactionSync(() => {
    const prev = db.getFirstSync<{ status: string }>('SELECT status FROM prayer_log WHERE day = ? AND prayer = ?;', [
      day,
      prayer,
    ]);
    db.runSync(
      `INSERT INTO prayer_log (day, prayer, status, source, marked_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(day, prayer) DO UPDATE SET
         status = excluded.status, source = excluded.source, marked_at = excluded.marked_at;`,
      [day, prayer, status, source, new Date().toISOString()],
    );
    if (prev?.status === 'qazo' && status === 'prayed') {
      const raw = rawBalance(prayer);
      if (raw < 0) addEntry(prayer, -raw, 'correction');
    }
  });
  emitChange();
}

/** Belgini olib tashlash (faqat vaqti hali chiqmagan namoz uchun maʼnoli) */
export function clearMark(day: string, prayer: PrayerId): void {
  getDb().runSync('DELETE FROM prayer_log WHERE day = ? AND prayer = ?;', [day, prayer]);
  emitChange();
}

/**
 * Vaqti chiqqan va belgilanmagan namozlarni 'qazo' (manba: auto) qilib yozadi.
 * Ilova ochilganda, oldinga chiqqanda va bildirishnoma tugmasidan keyin chaqiriladi.
 * Faqat oxirgi tekshiruvdan beri oʻtgan kunlar koʻriladi.
 */
export function reconcile(now = new Date()): number {
  const settings = loadSettings();
  const cal = calendarFor(settings);
  const trackingStart = new Date(settings.trackingStart);
  const through = getSetting('reconciled_through');
  // Oʻrnatish yarim tundan keyin boʻlsa, "namoz kuni" kechagi kun — shuning uchun −1
  const fromDay = through ? addDays(through, 1) : addDays(isoDay(trackingStart), -1);
  const currentDay = cal.prayerDayAt(now);
  if (fromDay > currentDay) return 0;

  const missed = findMissed(cal, fromDay, now, trackingStart, getRecords(fromDay, currentDay));
  const db = getDb();
  if (missed.length) {
    const at = now.toISOString();
    db.withTransactionSync(() => {
      for (const m of missed) {
        db.runSync(
          `INSERT OR IGNORE INTO prayer_log (day, prayer, status, source, marked_at) VALUES (?, ?, 'qazo', 'auto', ?);`,
          [m.day, m.prayer, at],
        );
      }
    });
  }
  // Joriy namoz kunidan oldingi kunlarning hamma oynalari yopilgan
  const closed = addDays(currentDay, -1);
  if (closed !== through) setSetting('reconciled_through', closed);
  if (missed.length) emitChange();
  return missed.length;
}

/* ── Qazo ─────────────────────────────────────────────────────────────────── */

export type QazoBalances = Record<PrayerId, number> & { total: number };

export function qazoBalances(): QazoBalances {
  const out = { total: 0 } as QazoBalances;
  for (const p of PRAYERS) {
    out[p] = Math.max(0, rawBalance(p));
    out.total += out[p];
  }
  return out;
}

/** Eski (kuzatuvdan oldingi) qazolarni qoʻshish */
export function addOldQazo(perPrayer: Partial<Record<PrayerId, number>>): void {
  const db = getDb();
  db.withTransactionSync(() => {
    for (const p of PRAYERS) {
      const n = Math.round(perPrayer[p] ?? 0);
      if (n > 0) addEntry(p, n, 'old');
    }
  });
  emitChange();
}

/** Bitta namozning qazosini oʻqildi deb ayirish. Qoldiqdan oshmaydi. */
export function makeup(prayer: PrayerId, count = 1): number {
  const n = Math.min(count, Math.max(0, rawBalance(prayer)));
  if (n <= 0) return 0;
  addEntry(prayer, -n, 'makeup');
  emitChange();
  return n;
}

/** "N kunlik qazo oʻqidim" — qoldigʻi bor har bir namozdan N tadan */
export function makeupDays(days: number): number {
  const db = getDb();
  let total = 0;
  db.withTransactionSync(() => {
    for (const p of PRAYERS) {
      const n = Math.min(days, Math.max(0, rawBalance(p)));
      if (n > 0) {
        addEntry(p, -n, 'makeup');
        total += n;
      }
    }
  });
  if (total) emitChange();
  return total;
}

export interface QazoEntry {
  id: number;
  prayer: PrayerId;
  delta: number;
  kind: 'old' | 'makeup' | 'correction';
  createdAt: string;
}

export function recentEntries(limit = 20): QazoEntry[] {
  return getDb()
    .getAllSync<QazoEntry>(
      `SELECT id, prayer, delta, kind, created_at AS createdAt FROM qazo_entries ORDER BY id DESC LIMIT ?;`,
      [limit],
    )
    .filter((e) => isPrayerId(e.prayer));
}

/**
 * Amalni bekor qilish. "Eski qazo" yozuvi bekor qilinganda, agar uning qazolari
 * allaqachon oʻqilgan boʻlsa, qoldiq manfiyga tushib keyingi haqiqiy qazoni
 * yashirardi — markPrayer'dagidek tuzatish yozuvi bilan nolga qaytaramiz.
 */
export function deleteEntry(id: number): void {
  const db = getDb();
  db.withTransactionSync(() => {
    const row = db.getFirstSync<{ prayer: string }>('SELECT prayer FROM qazo_entries WHERE id = ?;', [id]);
    db.runSync('DELETE FROM qazo_entries WHERE id = ?;', [id]);
    if (row && isPrayerId(row.prayer)) {
      const raw = rawBalance(row.prayer);
      if (raw < 0) addEntry(row.prayer, -raw, 'correction');
    }
  });
  emitChange();
}

/** Qazo boʻlgan namozlar (yangidan eskiga) — "aslida oʻqigandim" tuzatishi uchun */
export function recentQazo(limit = 30): LogRow[] {
  const order = (p: PrayerId) => PRAYERS.indexOf(p);
  return getDb()
    .getAllSync<LogRow>(
      `SELECT day, prayer, status, source, marked_at AS markedAt
         FROM prayer_log WHERE status = 'qazo' ORDER BY day DESC LIMIT ?;`,
      [limit],
    )
    .filter((r) => isPrayerId(r.prayer))
    .sort((a, b) => (a.day === b.day ? order(a.prayer) - order(b.prayer) : a.day < b.day ? 1 : -1));
}

/** Oxirgi N kunda qancha qazo oʻqilgan — "necha kunda tugaydi" hisobi uchun */
export function makeupSince(sinceIso: string): number {
  const row = getDb().getFirstSync<{ n: number }>(
    `SELECT COALESCE(-SUM(delta), 0) AS n FROM qazo_entries WHERE kind = 'makeup' AND created_at >= ?;`,
    [sinceIso],
  );
  return row?.n ?? 0;
}

/* ── Kun xulosasi ─────────────────────────────────────────────────────────── */

export function getDayNote(day: string): string {
  return getDb().getFirstSync<{ text: string }>('SELECT text FROM day_notes WHERE day = ?;', [day])?.text ?? '';
}

export function setDayNote(day: string, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    getDb().runSync('DELETE FROM day_notes WHERE day = ?;', [day]);
  } else {
    getDb().runSync(
      `INSERT INTO day_notes (day, text, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at;`,
      [day, trimmed, new Date().toISOString()],
    );
  }
  emitChange();
}

export function dayNotes(fromDay: string, toDay: string): { day: string; text: string }[] {
  return getDb().getAllSync<{ day: string; text: string }>(
    'SELECT day, text FROM day_notes WHERE day BETWEEN ? AND ? ORDER BY day DESC;',
    [fromDay, toDay],
  );
}

/* ── Bildirishnoma javoblari (takrorlanishdan himoya) ─────────────────────── */

/** true — yangi javob, ishlash kerak; false — allaqachon ishlangan */
export function claimResponse(key: string): boolean {
  const res = getDb().runSync('INSERT OR IGNORE INTO handled_responses (key, at) VALUES (?, ?);', [
    key,
    new Date().toISOString(),
  ]);
  return res.changes > 0;
}

export function pruneResponses(olderThanDays = 14): void {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  getDb().runSync('DELETE FROM handled_responses WHERE at < ?;', [cutoff]);
}
