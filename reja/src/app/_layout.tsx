// Faqat kerakli 3 ta vazn — paket indeksidan import qilinsa, 18 tasi ham bundle'ga tushadi
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from '../db/client';
import { handleResponse } from '../lib/actions';
import { subscribe } from '../lib/events';
import { configureNotifications, requestPermission, syncSchedule } from '../lib/notifications';
import { color } from '../theme/tokens';
import { Txt } from '../ui';

SplashScreen.preventAutoHideAsync();

// Havola orqali ochilganda ham (Namozimdan koʻchirish) ostida asosiy ekranlar tursin
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    try {
      getDb();
      setDbReady(true);
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const ready = (fontsLoaded || fontError) && (dbReady || dbError);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Navigator (Stack) chizilgandan keyingina — aks holda bildirishnomadan ochilganda
  // router "Root Layout hali yuklanmagan" deb navigatsiyani rad etadi
  useAppLifecycle(Boolean(ready) && dbReady);

  if (!ready) return null;

  if (dbError) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center', padding: 24, gap: 8 }}>
        <Txt variant="title">Maʼlumot bazasi ochilmadi</Txt>
        <Txt tone="muted">{dbError}</Txt>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="setup" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="task" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="habits" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="import" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Ilova hayot sikli:
 *   · ochilganda — ruxsat soʻrash, eslatmalarni sinxronlash
 *   · oldinga chiqqanda — yana (telefon uxlab qolgan, vaqt oʻtgan boʻlishi mumkin)
 *   · maʼlumot oʻzgarganda — eslatmalarni qayta rejalash (debounce bilan)
 *   · bildirishnoma bosilganda — tugma yoki kerakli ekranga oʻtish
 */
function useAppLifecycle(enabled: boolean) {
  const handledTap = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    (async () => {
      await configureNotifications();
      await requestPermission();
      syncSchedule();
    })();

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncSchedule();
    });

    // Har bir yozuvdan keyin eslatmalarni qayta rejalash — ketma-ket bosishlar birlashadi
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => syncSchedule(), 800);
    });

    const open = (resp: Notifications.NotificationResponse) => {
      handleResponse(resp, 'foreground').then(({ route }) => {
        const tapKey = `${resp.notification.request.identifier}|${resp.notification.date}`;
        if (route && handledTap.current !== tapKey) {
          handledTap.current = tapKey;
          setTimeout(() => router.navigate(route as never), 0);
        }
      });
    };

    // Ilova bildirishnomani bosib ochilgan boʻlsa
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const respSub = Notifications.addNotificationResponseReceivedListener(open);

    return () => {
      appSub.remove();
      respSub.remove();
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
}
