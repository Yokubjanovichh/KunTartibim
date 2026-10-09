/**
 * Namoz belgisini bosganda nima boʻlishi — Bugun va Tahlil ekranlarida bir xil.
 *   vaqti davom etyapti / kuzatuvdan oldingi → darhol "oʻqildi"
 *   oʻqilgan → belgini olib tashlash (vaqti chiqmagan) yoki qazoga oʻtkazish
 *   qazo → "aslida oʻqigandim"
 */

import { Alert } from 'react-native';

import type { PrayerWindow } from '../lib/prayer-times';
import { PRAYER_NAME, type PrayerId } from '../lib/prayers';
import type { PrayerStatus } from '../lib/status';
import { formatDayShort } from '../lib/time';
import { clearMark, markPrayer } from '../lib/tracker';

export function pressPrayer(day: string, p: PrayerId, status: PrayerStatus, win: PrayerWindow, now: Date): void {
  const name = PRAYER_NAME[p];
  if (status === 'upcoming') return;
  if (status === 'active' || status === 'untracked') {
    markPrayer(day, p, 'prayed', 'app');
    return;
  }
  if (status === 'prayed') {
    const ended = now.getTime() >= win.end.getTime();
    Alert.alert(`${name} · ${formatDayShort(day)}`, ended ? 'Oʻqilgan deb belgilangan. Oʻqilmagan boʻlsa, qazoga oʻtkazing.' : 'Oʻqilgan deb belgilangan.', [
      { text: 'Bekor', style: 'cancel' },
      ended
        ? { text: 'Qazo deb belgilash', style: 'destructive', onPress: () => markPrayer(day, p, 'qazo', 'app') }
        : { text: 'Belgini olib tashlash', style: 'destructive', onPress: () => clearMark(day, p) },
    ]);
    return;
  }
  Alert.alert(`${name} · ${formatDayShort(day)}`, 'Qazo boʻlgan. Vaqtida oʻqib, belgilashni unutgan boʻlsangiz — tuzating.', [
    { text: 'Bekor', style: 'cancel' },
    { text: 'Aslida oʻqigandim', onPress: () => markPrayer(day, p, 'prayed', 'review') },
  ]);
}
