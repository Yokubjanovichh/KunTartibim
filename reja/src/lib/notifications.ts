/**
 * Bildirishnomalar — telefon bilan ishlaydigan qism.
 * -------------------------------------------------
 * Reja `schedule.ts` da tuziladi; bu yerda u telefondagi mavjud eslatmalar bilan
 * solishtiriladi va faqat yangi/oʻzgarganlari qayta qoʻyiladi.
 *
 * ⚠️ Aniqlik: expo-notifications aniq budilnik (`setExactAndAllowWhileIdle`)
 * ishlatadi, lekin FAQAT ilovada aniq budilnik ruxsati boʻlsa. Ruxsat
 * `app.json` da (SCHEDULE_EXACT_ALARM + USE_EXACT_ALARM) eʼlon qilingan — usiz
 * eslatma "taxminiy" rejimga tushib, Doze'da daqiqalab kechikardi.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { calendarFor } from './calendar';
import { isTaskOpen, openTasksInRange, plannedDays } from './plan';
import { buildPlan, type NotificationData, type PlannedNotification, readData } from './schedule';
import { loadSettings } from './settings';
import { addDays } from './time';

export const CHANNEL_TASKS = 'ishlar';
export const CHANNEL_PLAN = 'reja';

/** 10 kun oldinga — ilova bir necha kun ochilmasa ham eslatmalar kelaveradi */
export const HORIZON_DAYS = 10;

/* ── Sozlash ──────────────────────────────────────────────────────────────── */

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured || Platform.OS !== 'android') return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_TASKS, {
    name: 'Ishlar',
    description: 'Aniq vaqtli ishlar eslatmasi',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 200, 150, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: '#E8A33D',
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_PLAN, {
    name: 'Reja va kun yakuni',
    description: 'Bugungi reja, kun boʻlagi ishlari, kun yakuni, yotish vaqti',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await registerCategories();
}

/**
 * Tugmalar. `opensAppToForeground: false` — ilova ochilmaydi, bosish fon
 * vazifasiga keladi (`background.ts`). Kategoriyalar telefonda saqlanadi,
 * shuning uchun ilova yopiq boʻlsa ham tugmalar koʻrinadi.
 */
async function registerCategories(): Promise<void> {
  const quiet = { opensAppToForeground: false };
  await Notifications.setNotificationCategoryAsync('task', [
    { identifier: 'task_done', buttonTitle: 'Bajarildi ✓', options: quiet },
    { identifier: 'snooze', buttonTitle: '15 daqiqadan keyin', options: quiet },
  ]);
}

export async function permissionStatus(): Promise<{ granted: boolean; canAsk: boolean }> {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAsk: p.canAskAgain };
}

export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/* ── Rejalashtirish ───────────────────────────────────────────────────────── */

function channelFor(kind: NotificationData['kind']): string {
  return kind === 'task' || kind === 'snooze' || kind === 'test' ? CHANNEL_TASKS : CHANNEL_PLAN;
}

async function scheduleOne(n: PlannedNotification): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: n.id,
    content: {
      title: n.title,
      body: n.body,
      data: n.data as unknown as Record<string, unknown>,
      ...(n.category !== 'info' ? { categoryIdentifier: n.category } : {}),
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      color: '#E8A33D',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: n.at,
      channelId: channelFor(n.data.kind),
    },
  });
}

export interface SyncResult {
  ok: boolean;
  reason?: 'permission' | 'disabled' | 'error';
  planned: number;
  changed: number;
  error?: string;
}

let running: Promise<SyncResult> | null = null;
let rerun = false;

/**
 * Telefondagi eslatmalarni rejaga keltiradi. Bir vaqtda bittasi ishlaydi; ishlab
 * turganda yana chaqirilsa, tugagach yana bir marta oʻtadi (oxirgi holat yutadi).
 */
export function syncSchedule(): Promise<SyncResult> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    let result: SyncResult;
    do {
      rerun = false;
      result = await syncOnce(new Date());
    } while (rerun);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(now: Date): Promise<SyncResult> {
  try {
    await configureNotifications();
    const settings = loadSettings();
    const perm = await Notifications.getPermissionsAsync();

    if (!perm.granted || !settings.enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return { ok: false, reason: !perm.granted ? 'permission' : 'disabled', planned: 0, changed: 0 };
    }

    const cal = calendarFor(settings);
    const firstDay = cal.prayerDayAt(now);
    const plan = buildPlan({
      now,
      horizonDays: HORIZON_DAYS,
      cal,
      settings,
      tasks: openTasksInRange(firstDay, addDays(firstDay, HORIZON_DAYS)).map((t) => ({
        id: t.id,
        title: t.title,
        day: t.day!,
        block: t.block,
        time: t.time,
        remindBefore: t.remindBefore,
        priority: t.priority,
      })),
      plannedDays: plannedDays(firstDay, addDays(firstDay, HORIZON_DAYS + 1)),
    });

    const want = new Map(plan.map((n) => [n.id, n]));
    // Hal boʻlgan: ish bajarilgan yoki voz kechilgan — eslatmasi kerak emas
    const resolved = (d: NotificationData) => d.taskId !== undefined && !isTaskOpen(d.taskId);

    let changed = 0;
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const req of existing) {
      const id = req.identifier;
      const data = readData(req.content);
      if (id.startsWith('snooze:') || id === 'test') {
        if (resolved(data)) await Notifications.cancelScheduledNotificationAsync(id);
        continue;
      }
      const target = want.get(id);
      if (target && data.h === target.data.h) {
        want.delete(id); // oʻzgarmagan — tegmaymiz
      } else {
        await Notifications.cancelScheduledNotificationAsync(id);
        changed++;
      }
    }
    for (const n of want.values()) {
      await scheduleOne(n);
      changed++;
    }

    // Bajarilgan ishning ekrandagi (pardadagi) eslatmasini yigʻishtiramiz
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      if (resolved(readData(n.request.content))) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }

    return { ok: true, planned: plan.length, changed };
  } catch (e) {
    return { ok: false, reason: 'error', planned: 0, changed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Qoʻshimcha ───────────────────────────────────────────────────────────── */

/** "15 daqiqadan keyin" — xuddi shu ish eslatmasini qayta qoʻyadi */
export async function scheduleSnooze(
  content: { title?: string | null; body?: string | null; categoryIdentifier?: string | null },
  data: NotificationData,
  minutes = 15,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze:task:${data.taskId ?? 'x'}`,
    content: {
      title: content.title ?? 'Eslatma',
      body: content.body ?? '',
      data: { ...data, kind: 'snooze', h: undefined } as unknown as Record<string, unknown>,
      ...(content.categoryIdentifier ? { categoryIdentifier: content.categoryIdentifier } : {}),
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      channelId: CHANNEL_TASKS,
    },
  });
}

/**
 * Sinov: 60 soniyadan keyin [Bajarildi ✓] tugmali eslatma.
 * Huawei sozlamalaridan keyin ilovani YOPIB kutish kerak — shunda fon vazifasi
 * ham tekshiriladi.
 */
export async function sendTest(seconds = 60): Promise<{ ok: boolean; error?: string }> {
  try {
    await configureNotifications();
    if (!(await requestPermission())) return { ok: false, error: 'Bildirishnomaga ruxsat berilmagan' };
    await Notifications.scheduleNotificationAsync({
      identifier: 'test',
      content: {
        title: 'Sinov eslatmasi',
        body: 'Eslatmalar ishlayapti. [Bajarildi ✓] tugmasini bosib koʻring — ilova ochilmasligi kerak.',
        data: { kind: 'test' },
        categoryIdentifier: 'task',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL_TASKS,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function countScheduled(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/** Keyingi rejalashtirilgan eslatma — Sozlamalarda tekshirish uchun */
export async function nextScheduled(): Promise<{ title: string; at: Date } | null> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  let best: { title: string; at: Date } | null = null;
  for (const r of all) {
    const t = r.trigger as { value?: number; date?: number | string } | null;
    const ms = typeof t?.value === 'number' ? t.value : t?.date ? new Date(t.date).getTime() : NaN;
    if (!Number.isFinite(ms)) continue;
    if (!best || ms < best.at.getTime()) best = { title: r.content.title ?? '', at: new Date(ms) };
  }
  return best;
}
