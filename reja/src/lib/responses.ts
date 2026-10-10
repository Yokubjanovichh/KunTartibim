/**
 * Bildirishnoma tugmasi bir marta ishlashi uchun: fon vazifasi va ochiq ilova
 * tinglovchisi bir xil bosishni ikkalasi ham olishi mumkin.
 */

import { getDb } from '../db/client';

/** true — bu javob endi bizniki (birinchi marta); false — allaqachon ishlangan */
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
