/**
 * Maʼlumot bazasi ulanishi.
 *
 * Ulanish dangasa ochiladi: ilova ekranlari ham, bildirishnoma tugmasining fon
 * vazifasi ham (ilova yopiq boʻlganda alohida JS muhitida) birinchi murojaatda
 * oʻzi ochib, migratsiyani oʻtkazadi.
 */

import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

export const DB_NAME = 'reja.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    const opened = SQLite.openDatabaseSync(DB_NAME);
    migrate(opened);
    db = opened;
  }
  return db;
}

function migrate(conn: SQLite.SQLiteDatabase): void {
  conn.execSync('PRAGMA journal_mode = WAL;');
  // Fon vazifasi va ilova bir vaqtda yozsa, darhol xato bermay biroz kutsin
  conn.execSync('PRAGMA busy_timeout = 3000;');
  // Odat oʻchirilsa, uning belgilari ham oʻchsin (ON DELETE CASCADE)
  conn.execSync('PRAGMA foreign_keys = ON;');

  const row = conn.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);

  for (const m of pending) {
    conn.withTransactionSync(() => {
      conn.execSync(m.sql);
      // PRAGMA parametr qabul qilmaydi — qiymat MIGRATIONS massividan, foydalanuvchidan emas
      conn.execSync(`PRAGMA user_version = ${m.version};`);
    });
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?;', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    [key, value],
  );
}
