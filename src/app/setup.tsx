import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { useDataVersion } from '../hooks/useData';
import { useSetupState } from '../hooks/useSetup';
import { lastTestAck } from '../lib/actions';
import { requestPermission, sendTest, syncSchedule } from '../lib/notifications';
import { hhmm } from '../lib/time';
import { saveSettings } from '../lib/settings';
import {
  openExactAlarmSettings,
  openHuaweiAppLaunch,
  openNotificationSettings,
  requestIgnoreBatteryOptimizations,
} from '../lib/system';
import { color, hairline, radius, space } from '../theme/tokens';
import { Button, Row, ScreenScroll, Spacer, Tap, Txt } from '../ui';

/**
 * Huawei'da eslatmalar ishonchli kelishi uchun — BITTA ekranda, qadam-baqadam emas.
 * Har bir band: holati + uni toʻgʻridan-toʻgʻri ochadigan tugma.
 * Tizim sozlamalaridan qaytilganda holat avtomatik qayta tekshiriladi.
 */
export default function SetupScreen() {
  const s = useSetupState();
  const version = useDataVersion();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [ack, setAck] = useState(() => lastTestAck());

  // Sinov tugmasi fon vazifasida (boshqa JS muhitida) yoziladi — bu ekran uni
  // faqat ilova oldinga chiqqanda yoki maʼlumot oʻzgarganda qayta oʻqiy oladi
  useEffect(() => {
    setAck(lastTestAck());
  }, [version]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setAck(lastTestAck());
    });
    return () => sub.remove();
  }, []);

  const askNotifications = async () => {
    if (s.canAskNotifications) {
      await requestPermission();
      s.refresh();
      syncSchedule();
    } else {
      await openNotificationSettings();
    }
  };

  const runTest = async () => {
    const r = await sendTest(60);
    setTestMsg(r.ok ? 'Yuborildi. Endi ilovani yoping (oxirgi ilovalardan ham surib tashlang) va kuting.' : r.error ?? 'Yuborilmadi');
  };

  return (
    <ScreenScroll withTabBar={false}>
      <Row style={styles.top}>
        <Txt variant="overline" tone="faint">
          Sozlash
        </Txt>
        <Tap onPress={() => router.back()} hitSlop={12}>
          <Txt variant="title" tone="muted">
            ✕
          </Txt>
        </Tap>
      </Row>
      <View style={styles.intro}>
        <Txt variant="title">Eslatmalar oʻz vaqtida kelishi uchun</Txt>
        <Txt variant="body" tone="muted" style={{ marginTop: space.sm }}>
          Huawei batareyani tejash uchun fondagi ilovalarni oʻchirib qoʻyadi — shunda namoz eslatmasi kelmay qoladi.
          Quyidagilarni bir marta qilsangiz yetarli.
        </Txt>
      </View>

      <Step n={1} title="Bildirishnomalarga ruxsat" done={s.notifications}>
        <Txt variant="caption" tone="muted" style={{ lineHeight: 18 }}>
          Usiz hech qanday eslatma koʻrinmaydi. EMUI baʼzan yangi ilovani «ovozsiz» qilib qoʻyadi — eslatma kelsa-yu
          ekranda chiqmasa, «Namoz vaqtlari» toifasida «Баннеры», «Звук» va «Экран блокировки» ni yoqing.
        </Txt>
        <Spacer size={space.md} />
        {s.notifications ? (
          <Button title="Bildirishnoma sozlamalari" kind="secondary" onPress={openNotificationSettings} />
        ) : (
          <Button title={s.canAskNotifications ? 'Ruxsat berish' : 'Sozlamalarni ochish'} kind="accent" onPress={askNotifications} />
        )}
      </Step>

      <Step n={2} title="Batareya cheklovidan chiqarish" done={s.batteryFree === true} unknown={s.batteryFree === null}>
        <Txt variant="caption" tone="muted">
          Tizim «Ilovaga fonda ishlashga ruxsat berilsinmi?» deb soʻraydi — «Разрешить» ni bosing.
        </Txt>
        {s.batteryFree !== true && (
          <>
            <Spacer size={space.md} />
            <Button title="Ruxsat berish" kind="accent" onPress={requestIgnoreBatteryOptimizations} />
          </>
        )}
      </Step>

      <Step n={3} title="Ilovalarni ishga tushirish (Huawei)" done={s.huaweiLaunch}>
        <Txt variant="caption" tone="muted" style={{ lineHeight: 18 }}>
          Настройки → Батарея → Запуск приложений → <Txt variant="caption">Kun tartibim</Txt>
          {'\n'}«Автоматическое управление» ni oʻchiring va ochilgan oynada uchala bandni yoqing:
          {'\n'}• Автозапуск  • Косвенный запуск  • Работа в фоне
        </Txt>
        <Spacer size={space.md} />
        <Row style={{ gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Sahifani ochish" kind={s.huaweiLaunch ? 'secondary' : 'accent'} onPress={openHuaweiAppLaunch} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={s.huaweiLaunch ? 'Bajarilgan ✓' : 'Bajardim'}
              kind="secondary"
              onPress={() => saveSettings({ huaweiLaunchDone: !s.huaweiLaunch })}
            />
          </View>
        </Row>
        <Txt variant="caption" tone="faint" style={{ marginTop: space.sm }}>
          Bu sozlamani tekshirib boʻlmaydi — bajargach «Bajardim» ni bosing.
        </Txt>
      </Step>

      <Step n={4} title="Будильники и напоминания" optional>
        <Txt variant="caption" tone="muted">
          Eslatma daqiqasida kelishi uchun. Odatda avtomatik yoqilgan boʻladi — ochib, yoqilganiga ishonch hosil qiling.
        </Txt>
        <Spacer size={space.md} />
        <Button title="Tekshirish" kind="secondary" onPress={openExactAlarmSettings} />
      </Step>

      <Step n={5} title="Sinab koʻrish" optional>
        <Txt variant="caption" tone="muted" style={{ lineHeight: 18 }}>
          1 daqiqadan keyin sinov eslatmasi keladi. Ilovani yopib kuting. Kelganda «Oʻqidim ✓» ni bosing — ilova
          ochilmasdan eslatma yopilishi kerak.
        </Txt>
        <Spacer size={space.md} />
        <Button title="Sinov eslatmasi" kind="secondary" onPress={runTest} />
        {testMsg && (
          <Txt variant="caption" tone="accent" style={{ marginTop: space.sm }}>
            {testMsg}
          </Txt>
        )}
        {ack && (
          <Txt variant="caption" tone={ack.via === 'background' ? 'default' : 'muted'} style={{ marginTop: space.sm }}>
            {ack.via === 'background'
              ? `✓ Ishladi: ${hhmm(ack.at)} da ilova yopiq holda tugma bosildi — fon vazifasi ishlayapti.`
              : `Tugma ${hhmm(ack.at)} da ilova ochiq holda bosildi. Ilovani yopib yana sinang — fon vazifasi ham tekshirilsin.`}
          </Txt>
        )}
      </Step>

      <View style={styles.tip}>
        <Txt variant="caption" tone="faint" style={{ lineHeight: 18 }}>
          Qoʻshimcha: oxirgi ilovalar roʻyxatida «Kun tartibim» kartasini pastga torting — qulf belgisi chiqadi. Shunda
          «hammasini tozalash» uni yopmaydi.
        </Txt>
      </View>
    </ScreenScroll>
  );
}

function Step({
  n,
  title,
  done,
  unknown,
  optional,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  unknown?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  const state = optional ? null : done ? 'ok' : unknown ? '?' : 'need';
  return (
    <View style={[styles.step, state === 'need' && { borderColor: color.accentMuted }]}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Row style={{ flex: 1, justifyContent: 'flex-start', gap: space.md, alignItems: 'flex-start' }}>
          <Txt variant="label" tone="faint" numeric style={{ marginTop: 2 }}>
            {n}
          </Txt>
          <Txt variant="bodyMedium" style={{ flex: 1 }}>
            {title}
          </Txt>
        </Row>
        {state === 'ok' && (
          <Txt variant="label" tone="muted">
            ✓
          </Txt>
        )}
        {state === 'need' && (
          <Txt variant="label" tone="accent">
            Kerak
          </Txt>
        )}
        {state === '?' && (
          <Txt variant="label" tone="faint">
            ?
          </Txt>
        )}
      </Row>
      <View style={{ marginTop: space.sm, marginLeft: space.lg + space.xs }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.lg },
  intro: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg },
  step: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  tip: { paddingHorizontal: space.xl, paddingTop: space.sm },
});
