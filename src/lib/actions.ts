/**
 * Bildirishnoma tugmalari — bitta ishlov beruvchi.
 *
 * Ikki yoʻldan keladi:
 *   · fon vazifasi (ilova yopiq yoki orqada) — `background.ts`
 *   · tinglovchi (ilova ochiq) — `app/_layout.tsx`
 * Ilova orqada tirik boʻlganda ikkalasi ham bir bosishni olishi mumkin, shuning
 * uchun har bir javob bazada "band qilinadi" — ikkinchi marta ishlamaydi.
 * Bu ayniqsa "qazo oʻqidim" uchun muhim: ikki marta ayirilsa, hisob buziladi.
 */

import * as Notifications from 'expo-notifications';

import { getSetting, setSetting } from '../db/client';
import { emitChange } from './events';
import { scheduleSnooze, syncSchedule } from './notifications';
import { isPrayerId } from './prayers';
import { readData } from './schedule';
import { loadSettings } from './settings';
import { claimResponse, makeupDays, markPrayer, pruneResponses, reconcile } from './tracker';

export interface ActionOutcome {
  /** Oddiy bosishda ochiladigan ekran */
  route?: string;
}

export const TEST_ACK_KEY = 'test_ack';

/** Oxirgi sinov tugmasi qachon va qaysi yoʻldan ishlagan (fon vazifasi yoki ochiq ilova) */
export function lastTestAck(): { at: Date; via: 'background' | 'foreground' } | null {
  try {
    const v = JSON.parse(getSetting(TEST_ACK_KEY) ?? 'null') as { at: string; via: 'background' | 'foreground' } | null;
    return v ? { at: new Date(v.at), via: v.via } : null;
  } catch {
    return null;
  }
}

export async function handleResponse(
  resp: Notifications.NotificationResponse,
  origin: 'background' | 'foreground',
): Promise<ActionOutcome> {
  const req = resp.notification.request;
  // Fon vazifasida kontent xom keladi (faqat dataString) — readData ikkalasini ham oʻqiydi
  const data = readData(req.content);
  const action = resp.actionIdentifier;

  if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return { route: data.route };
  }

  const key = `${req.identifier}|${action}|${resp.notification.date}`;
  if (!claimResponse(key)) return {};

  const prayers = (data.prayers ?? []).filter(isPrayerId);

  switch (action) {
    case 'prayed':
      if (data.kind === 'test') {
        // Sinov: tugma qaysi yoʻldan kelgani bilan yoziladi — Sozlash ekrani koʻrsatadi
        setSetting(TEST_ACK_KEY, JSON.stringify({ at: new Date().toISOString(), via: origin }));
        emitChange();
      }
      if (data.day) for (const p of prayers) markPrayer(data.day, p, 'prayed', 'notification');
      break;
    case 'prayed_all':
      if (data.day) {
        markPrayer(data.day, 'xufton', 'prayed', 'notification');
        markPrayer(data.day, 'vitr', 'prayed', 'notification');
      }
      break;
    case 'snooze':
      await scheduleSnooze(req.content, data);
      break;
    case 'makeup_day':
      makeupDays(loadSettings().qazoDailyDays);
      break;
  }

  await Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
  reconcile();
  pruneResponses();
  await syncSchedule();
  return {};
}
