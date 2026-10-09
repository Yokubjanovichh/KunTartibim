/**
 * Android va Huawei sozlama sahifalarini ochish.
 *
 * Huawei'ning batareya tejagichi fondagi ilovalarni oʻldiradi — eslatma
 * ishonchli kelishi uchun ilovani "Запуск приложений" boʻlimida qoʻlda
 * boshqarishga oʻtkazish shart (dontkillmyapp.com/huawei). Bu sahifaning
 * nomi EMUI versiyasiga qarab har xil, shuning uchun bir nechtasi sinaladi.
 */

import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';

const PKG = Application.applicationId ?? 'uz.kuntartibim.app';

async function tryOpen(action: string, params?: IntentLauncher.IntentLauncherParams): Promise<boolean> {
  try {
    await IntentLauncher.startActivityAsync(action, params);
    return true;
  } catch {
    return false;
  }
}

export async function openAppDetails(): Promise<boolean> {
  return tryOpen(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${PKG}` });
}

export async function openNotificationSettings(): Promise<boolean> {
  return (
    (await tryOpen(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
      extra: { 'android.provider.extra.APP_PACKAGE': PKG },
    })) || openAppDetails()
  );
}

/** Android 12+: "Будильники и напоминания" ruxsati */
export async function openExactAlarmSettings(): Promise<boolean> {
  return (
    (await tryOpen(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, { data: `package:${PKG}` })) ||
    openAppDetails()
  );
}

/** Tizim oynasi: "Ilovaga doim fonda ishlashga ruxsat berilsinmi?" */
export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  return (
    (await tryOpen(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${PKG}`,
    })) || tryOpen(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
  );
}

export async function isBatteryOptimized(): Promise<boolean | null> {
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return null;
  }
}

const HUAWEI_LAUNCH_SCREENS = [
  'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity', // EMUI 9+
  'com.huawei.systemmanager.optimize.process.ProtectActivity', // EMUI 5–8
  'com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity',
];

/** Настройки → Батарея → Запуск приложений */
export async function openHuaweiAppLaunch(): Promise<boolean> {
  for (const className of HUAWEI_LAUNCH_SCREENS) {
    if (await tryOpen('android.intent.action.MAIN', { packageName: 'com.huawei.systemmanager', className })) {
      return true;
    }
  }
  return openAppDetails();
}
