import * as Application from 'expo-application';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useSetupState } from '../../hooks/useSetup';
import { checkUpdateNow, useUpdateState } from '../../hooks/useUpdate';
import { calendarFor } from '../../lib/calendar';
import { countScheduled, nextScheduled, sendTest, syncSchedule } from '../../lib/notifications';
import { TORAQORGON } from '../../lib/prayer-times';
import { saveSettings } from '../../lib/settings';
import { formatDayLong, formatHm, hhmm, isoDay, parseHm } from '../../lib/time';
import { applyUpdate, currentVersionInfo, isUpdatesSupported } from '../../lib/updates';
import { space } from '../../theme/tokens';
import { Divider, Group, ListRow, ScreenScroll, SectionTitle, Stepper, Toggle, Txt } from '../../ui';

export default function SettingsScreen() {
  const settings = useSettings();
  const setup = useSetupState();
  const update = useUpdateState();
  const now = useNow(60_000);
  const cal = calendarFor(settings);
  const times = cal.times(cal.prayerDayAt(now));

  const [scheduled, setScheduled] = useState<{ count: number; next: { title: string; at: Date } | null } | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const loadScheduled = async () => {
    await syncSchedule();
    setScheduled({ count: await countScheduled(), next: await nextScheduled() });
  };

  useEffect(() => {
    loadScheduled();
  }, [settings]);

  const runTest = async () => {
    const r = await sendTest(60);
    setTestMsg(
      r.ok
        ? 'Yuborildi. Ilovani yoping va 1 daqiqa kuting. Kelganda «Bajarildi ✓» ni bosing — ilova ochilmasligi kerak.'
        : r.error ?? 'Yuborilmadi',
    );
  };

  const version = currentVersionInfo();

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Txt variant="title">Sozlamalar</Txt>
      </View>

      {/* ── Ishonchlilik ── */}
      <Group>
        <ListRow
          title="Eslatmalar ishonchliligi"
          hint={setup.missing > 0 ? `${setup.missing} ta sozlama qoldi — Huawei fonda oʻchirib qoʻyishi mumkin` : 'Hammasi sozlangan'}
          tone={setup.missing > 0 ? 'accent' : 'default'}
          right="›"
          onPress={() => router.push('/setup')}
        />
      </Group>

      {/* ── Eslatmalar ── */}
      <SectionTitle>Eslatmalar</SectionTitle>
      <Group>
        <ListRow
          title="Eslatmalar"
          hint="Ishlar, kunlik reja, kun yakuni"
          right={<Toggle value={settings.enabled} />}
          onPress={() => saveSettings({ enabled: !settings.enabled })}
        />
        <Divider inset={space.lg} />
        <ListRow
          title="Bugungi reja"
          hint="Bomdoddan 30 daqiqa keyin: asosiy ishlar va kun rejasi"
          right={<Toggle value={settings.morningEnabled} />}
          onPress={() => saveSettings({ morningEnabled: !settings.morningEnabled })}
        />
        <Divider inset={space.lg} />
        <ListRow
          title="Kun boʻlagi boshlanganda"
          hint="Namozdan 20 daqiqa keyin: «Asrdan keyin» ishlari"
          right={<Toggle value={settings.blockEnabled} />}
          onPress={() => saveSettings({ blockEnabled: !settings.blockEnabled })}
        />
        <Divider inset={space.lg} />
        <TimeRow
          title="Kun yakuni"
          hint="Kunni yopish va ertangi reja"
          value={settings.reviewTime}
          min={18 * 60}
          onChange={(v) => saveSettings({ reviewTime: v })}
        />
        <Divider inset={space.lg} />
        <ListRow
          title="Yotish vaqti"
          hint="Ertangi Bomdodgacha necha soat uyqu qolganini aytadi"
          right={<Toggle value={settings.bedtimeEnabled} />}
          onPress={() => saveSettings({ bedtimeEnabled: !settings.bedtimeEnabled })}
        />
        {settings.bedtimeEnabled && (
          <>
            <Divider inset={space.lg} />
            <NightTimeRow title="Soat" hint="Yarim tundan keyin ham boʻladi — asta-sekin oldinga suring" value={settings.bedtime} onChange={(v) => saveSettings({ bedtime: v })} />
          </>
        )}
        <Divider inset={space.lg} />
        <ListRow title="Sinov eslatmasi" hint={testMsg ?? '1 daqiqadan keyin keladi — tugmani sinash uchun'} right="›" onPress={runTest} />
        <Divider inset={space.lg} />
        <ListRow
          title="Rejalashtirilgan"
          hint={
            scheduled?.next
              ? `Keyingisi: ${scheduled.next.title} · ${isoDay(scheduled.next.at) === isoDay(new Date()) ? '' : `${formatDayLong(isoDay(scheduled.next.at))}, `}${hhmm(scheduled.next.at)}`
              : settings.enabled
                ? 'Hozircha eslatma yoʻq — ishga vaqt va eslatma qoʻshing'
                : 'Eslatmalar oʻchiq'
          }
          right={scheduled ? `${scheduled.count} ta` : '…'}
          onPress={loadScheduled}
        />
      </Group>

      {/* ── Reja ── */}
      <SectionTitle>Reja</SectionTitle>
      <Group>
        <ListRow title="Odatlar" hint="Qoʻshish, tahrirlash, arxiv" right="›" onPress={() => router.push('/habits')} />
        <Divider inset={space.lg} />
        <ListRow
          title="Kun boʻlaklari"
          hint={`${TORAQORGON.name} namoz vaqtlari: Bomdod ${hhmm(times.bomdod)} · Peshin ${hhmm(times.peshin)} · Asr ${hhmm(times.asr)} · Shom ${hhmm(times.shom)} · Xufton ${hhmm(times.xufton)}`}
        />
        <Divider inset={space.lg} />
        <ListRow
          title="Namozimdan koʻchirish"
          hint={
            settings.importedAt
              ? `Koʻchirilgan: ${formatDayLong(isoDay(new Date(settings.importedAt)))}, ${hhmm(new Date(settings.importedAt))}`
              : 'Namozim → Sozlamalar → «Kun tartibim»ga koʻchirish — eski ishlar shu yerga oʻtadi'
          }
        />
      </Group>

      {/* ── Ilova ── */}
      <SectionTitle>Ilova</SectionTitle>
      <Group>
        <ListRow
          title="Versiya"
          hint={
            version.createdAt
              ? `${version.isEmbedded ? 'Oʻrnatilgan APK' : 'OTA yangilanish'} · ${formatDayLong(isoDay(version.createdAt))}, ${hhmm(version.createdAt)}`
              : 'Ishlab chiqish rejimi'
          }
          right={Application.nativeApplicationVersion ?? '—'}
        />
        {isUpdatesSupported() && (
          <>
            <Divider inset={space.lg} />
            {update.ready ? (
              <ListRow title="Yangilanish tayyor" hint="Qoʻllash uchun bosing — ilova qayta ochiladi" tone="accent" right="Qoʻllash" onPress={applyUpdate} />
            ) : (
              <ListRow
                title="Yangilanishni tekshirish"
                hint={update.error ?? (update.checkedAt ? `Oxirgi tekshiruv: ${hhmm(update.checkedAt)} · yangi versiya yoʻq` : 'Ilovani oʻchirmasdan yangilanadi')}
                right={update.checking ? '…' : '›'}
                onPress={checkUpdateNow}
              />
            )}
          </>
        )}
      </Group>
    </ScreenScroll>
  );
}

/** Vaqt tanlash — ±15 daqiqa qadam bilan */
function TimeRow({
  title,
  hint,
  value,
  min,
  onChange,
}: {
  title: string;
  hint?: string;
  value: string;
  min: number;
  onChange: (v: string) => void;
}) {
  const minutes = parseHm(value) ?? min;
  return (
    <ListRow
      title={title}
      hint={hint}
      right={<Stepper value={minutes} min={min} max={23 * 60 + 45} step={15} onChange={(v) => onChange(formatHm(v))} format={formatHm} />}
    />
  );
}

/**
 * Kechki vaqt: 20:00 dan ertasi 02:00 gacha. Ichkarida yarim tundan keyingi vaqtlar
 * 24 soat qoʻshib saqlanadi, shunda stepper 23:45 → 00:00 → 00:15 tarzida uzluksiz yuradi.
 */
function NightTimeRow({ title, hint, value, onChange }: { title: string; hint?: string; value: string; onChange: (v: string) => void }) {
  const raw = parseHm(value) ?? 23 * 60;
  const minutes = raw < 12 * 60 ? raw + 24 * 60 : raw;
  return (
    <ListRow
      title={title}
      hint={hint}
      right={<Stepper value={minutes} min={20 * 60} max={26 * 60} step={15} onChange={(v) => onChange(formatHm(v))} format={formatHm} />}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.lg },
});
