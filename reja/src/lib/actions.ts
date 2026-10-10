/**
 * Bildirishnoma tugmalari — bitta ishlov beruvchi.
 *
 * Ikki yoʻldan keladi:
 *   · fon vazifasi (ilova yopiq yoki orqada) — `background.ts`
 *   · tinglovchi (ilova ochiq) — `app/_layout.tsx`
 * Ilova orqada tirik boʻlganda ikkalasi ham bir bosishni olishi mumkin, shuning
 * uchun har bir javob bazada "band qilinadi" — ikkinchi marta ishlamaydi.
 */

import * as Notifications from 'expo-notifications';

import { getSetting, setSetting } from '../db/client';
import { emitChange } from './events';
import { scheduleSnooze, syncSchedule } from './notifications';
import { setTaskDone } from './plan';
import { claimResponse, pruneResponses } from './responses';
import { readData } from './schedule';

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

  switch (action) {
    case 'task_done':
      if (data.kind === 'test') {
        // Sinov: tugma qaysi yoʻldan kelgani bilan yoziladi — Sozlash ekrani koʻrsatadi
        setSetting(TEST_ACK_KEY, JSON.stringify({ at: new Date().toISOString(), via: origin }));
        emitChange();
      } else if (data.taskId !== undefined) {
        setTaskDone(data.taskId, true);
      }
      break;
    case 'snooze':
      await scheduleSnooze(req.content, data);
      break;
  }

  await Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
  pruneResponses();
  await syncSchedule();
  return {};
}
