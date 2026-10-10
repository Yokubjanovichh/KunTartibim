/**
 * Fon vazifasi — ilova yopiq boʻlganda bildirishnoma tugmasini ishlaydi.
 *
 * expo-notifications 56 (Android) maxsus tugma bosilganda va ilova oldinda
 * boʻlmasa, roʻyxatdan oʻtgan vazifani "headless" JS'da ishga tushiradi
 * (ExpoHandlingDelegate.handleNotificationResponse → runTaskManagerTasks).
 * Shuning uchun [Bajarildi ✓] ilovani ochmasdan ishni belgilaydi.
 *
 * Bu fayl `index.ts` da expo-router'dan OLDIN import qilinadi.
 */

import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { handleResponse } from './actions';

export const NOTIFICATION_TASK = 'kunreja-notification-action';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  try {
    await handleResponse(data as Notifications.NotificationResponse, 'background');
  } catch {
    // Fonda koʻrsatadigan joy yoʻq. Belgilanmay qolsa — ilova ochilganda
    // foydalanuvchi oʻzi belgilaydi yoki kun yakunida tuzatadi.
  }
});

Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});
