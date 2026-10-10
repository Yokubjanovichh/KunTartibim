/**
 * OTA yangilanishlar — ilovani oʻchirmasdan yangilash.
 *
 * Kod oʻzgarishi `eas update` bilan yuboriladi; ilova ochilganda fonda yuklab
 * oladi va keyingi ishga tushishda qoʻllaydi. Kutib oʻtirmaslik uchun
 * Sozlamalarda "Qoʻllash" tugmasi bor. Development rejimida modul oʻchiq.
 *
 * ⚠️ Native paket qoʻshilsa, OTA yetmaydi — yangi APK kerak. Uni ham oʻchirmasdan,
 * eskisining ustidan oʻrnatiladi (EAS imzo kaliti bir xil). Bunday holatda
 * app.json dagi `version` oshiriladi: runtimeVersion shundan olinadi va eski
 * APK'ga mos kelmaydigan yangilanish unga tushmaydi.
 */

import * as Updates from 'expo-updates';

export function isUpdatesSupported(): boolean {
  return Updates.isEnabled;
}

export async function checkAndDownload(): Promise<{ ready: boolean; error: string | null }> {
  if (!Updates.isEnabled) return { ready: false, error: null };
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { ready: false, error: null };
    await Updates.fetchUpdateAsync();
    return { ready: true, error: null };
  } catch (e) {
    return { ready: false, error: e instanceof Error ? e.message : 'Tekshirib boʻlmadi' };
  }
}

export async function applyUpdate(): Promise<void> {
  if (Updates.isEnabled) await Updates.reloadAsync();
}

export function currentVersionInfo(): { createdAt: Date | null; isEmbedded: boolean; channel: string | null } {
  return {
    createdAt: Updates.createdAt ?? null,
    isEmbedded: Updates.isEmbeddedLaunch,
    channel: Updates.channel ?? null,
  };
}
