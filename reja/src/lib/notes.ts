/**
 * Kun va hafta xulosalari (Tahlil ekrani). Kalit — kun ('2026-10-10') yoki
 * hafta ('week:2026-10-05'). Boʻsh matn — yozuv oʻchiriladi.
 */

import { getDb } from '../db/client';
import { emitChange } from './events';

export function getDayNote(day: string): string {
  return getDb().getFirstSync<{ text: string }>('SELECT text FROM day_notes WHERE day = ?;', [day])?.text ?? '';
}

export function setDayNote(day: string, text: string): void {
  const value = text.trim();
  if (!value) {
    getDb().runSync('DELETE FROM day_notes WHERE day = ?;', [day]);
  } else {
    getDb().runSync(
      `INSERT INTO day_notes (day, text, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at;`,
      [day, value, new Date().toISOString()],
    );
  }
  emitChange();
}

/** Kunlik xulosalar (hafta xulosalarisiz), yangisi birinchi */
export function dayNotes(fromDay: string, toDay: string): { day: string; text: string }[] {
  return getDb().getAllSync<{ day: string; text: string }>(
    `SELECT day, text FROM day_notes WHERE day BETWEEN ? AND ? AND day NOT LIKE 'week:%' ORDER BY day DESC;`,
    [fromDay, toDay],
  );
}
