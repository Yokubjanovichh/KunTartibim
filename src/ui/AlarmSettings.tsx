/**
 * Sozlamalar → Bomdod budilnigi.
 * Holat (keyingi budilnik, ruxsatlar) native moduldan oʻqiladi — sinxronlash
 * asinxron boʻlgani uchun sozlama oʻzgargach biroz kutib qayta oʻqiladi.
 */

import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { alarmStatus, type AlarmStatus, alarmSupported, openFullScreenSettings, testAlarm } from '../lib/alarm';
import { alarmTimeFor } from '../lib/alarm-plan';
import { type AppSettings, saveSettings } from '../lib/settings';
import { openAppDetails, openExactAlarmSettings } from '../lib/system';
import { addDays, formatDayLong, hhmm, isoDay } from '../lib/time';
import { calendarFor } from '../lib/tracker';
import { space } from '../theme/tokens';
import { Divider, Group, ListRow, SectionTitle, Stepper, Toggle } from './index';

export function AlarmSection({ settings, now }: { settings: AppSettings; now: Date }) {
  const [status, setStatus] = useState<AlarmStatus | null>(() => alarmStatus());
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setStatus(alarmStatus()), 1500);
    return () => clearTimeout(t);
  }, [settings]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setStatus(alarmStatus());
    });
    return () => sub.remove();
  }, []);

  if (!alarmSupported) {
    return (
      <>
        <SectionTitle>Bomdod budilnigi</SectionTitle>
        <Group>
          <ListRow
            title="Yangi versiya kerak"
            hint="Uygʻotuvchi budilnik ilovaning 1.1.0 versiyasida. APK'ni ustidan oʻrnating — maʼlumotlar saqlanadi."
            tone="faint"
          />
        </Group>
      </>
    );
  }

  const cal = calendarFor(settings);
  const tomorrow = addDays(cal.prayerDayAt(now), 1);
  const sample = alarmTimeFor(cal, tomorrow, settings.alarmOffset);
  const beforeSunrise = Math.round((cal.times(tomorrow).quyosh.getTime() - sample.getTime()) / 60_000);
  const next = status?.next ? new Date(status.next) : null;

  const nextHint = !settings.alarmEnabled
    ? 'Oʻchiq'
    : next
      ? `Keyingisi: ${isoDay(next) === isoDay(now) ? 'bugun' : formatDayLong(isoDay(next))}, ${hhmm(next)}`
      : 'Rejalanmoqda…';

  const runTest = () => {
    testAlarm(30);
    setTestMsg('30 soniyadan keyin chaladi. Telefonni qulflang — ekran oʻzi yonib, ovoz chalishi kerak.');
  };

  return (
    <>
      <SectionTitle>Bomdod budilnigi</SectionTitle>
      <Group>
        <ListRow
          title="Uygʻotuvchi budilnik"
          hint={nextHint}
          right={<Toggle value={settings.alarmEnabled} />}
          onPress={() => saveSettings({ alarmEnabled: !settings.alarmEnabled })}
        />
        {settings.alarmEnabled && (
          <>
            <Divider inset={space.lg} />
            <ListRow
              title="Qachon chalsin"
              hint={`Bomdod kirgandan keyin · quyosh chiqishiga ${beforeSunrise} daqiqa qoladi`}
              right={
                <Stepper
                  value={settings.alarmOffset}
                  min={0}
                  max={45}
                  step={5}
                  onChange={(v) => saveSettings({ alarmOffset: v })}
                  format={(v) => (v === 0 ? 'darhol' : `+${v} daq`)}
                />
              }
            />
            <Divider inset={space.lg} />
            <ListRow
              title="Keyinga surish"
              hint={settings.alarmMaxSnooze ? `${settings.alarmSnoozeMinutes} daqiqadan` : 'Surib boʻlmaydi — faqat «Turdim»'}
              right={
                <Stepper
                  value={settings.alarmMaxSnooze}
                  min={0}
                  max={3}
                  onChange={(v) => saveSettings({ alarmMaxSnooze: v })}
                  format={(v) => (v === 0 ? 'yoʻq' : `${v} marta`)}
                />
              }
            />
            <Divider inset={space.lg} />
            <ListRow
              title="Uygʻonish tekshiruvi"
              hint={`«Turdim»dan ${settings.alarmCheckDelay} daqiqa keyin «Turdingizmi?» deb soʻraydi, javob boʻlmasa qayta chaladi. Bomdodni belgilasangiz soʻramaydi.`}
              right={<Toggle value={settings.alarmCheck} />}
              onPress={() => saveSettings({ alarmCheck: !settings.alarmCheck })}
            />
            {settings.alarmCheck && (
              <>
                <Divider inset={space.lg} />
                <ListRow
                  title="Tekshiruv vaqti"
                  hint="Tahoratga borib kelishga yetsin"
                  right={
                    <Stepper
                      value={settings.alarmCheckDelay}
                      min={5}
                      max={30}
                      step={5}
                      onChange={(v) => saveSettings({ alarmCheckDelay: v })}
                      format={(v) => `${v} daq`}
                    />
                  }
                />
              </>
            )}
            <Divider inset={space.lg} />
            <ListRow
              title="Misol yechib oʻchirish"
              hint="Yarim uyquda oʻchirib qoʻymaslik uchun: «34 + 27 = ?»"
              right={<Toggle value={settings.alarmChallenge} />}
              onPress={() => saveSettings({ alarmChallenge: !settings.alarmChallenge })}
            />
            <Divider inset={space.lg} />
            <ListRow title="Sinab koʻrish" hint={testMsg ?? '30 soniyadan keyin chaladi'} tone={testMsg ? 'accent' : 'default'} right="›" onPress={runTest} />

            {status && !status.canScheduleExact && (
              <>
                <Divider inset={space.lg} />
                <ListRow
                  title="Aniq vaqt ruxsati oʻchiq"
                  hint="Budilnik kechikishi mumkin. Bosing → «Будильники и напоминания»ni yoqing"
                  tone="danger"
                  right="›"
                  onPress={openExactAlarmSettings}
                />
              </>
            )}
            {status && !status.canFullScreen && (
              <>
                <Divider inset={space.lg} />
                <ListRow
                  title="Qulf ekranida koʻrsatish ruxsati yoʻq"
                  hint="Bosing va ruxsat bering — aks holda faqat bildirishnoma chiqadi"
                  tone="danger"
                  right="›"
                  onPress={() => {
                    if (!openFullScreenSettings()) openAppDetails();
                  }}
                />
              </>
            )}
          </>
        )}
      </Group>
      <View style={{ height: space.xs }} />
    </>
  );
}
