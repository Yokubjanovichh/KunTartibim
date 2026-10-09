import * as Application from 'expo-application';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useSetupState } from '../../hooks/useSetup';
import { checkUpdateNow, useUpdateState } from '../../hooks/useUpdate';
import { countScheduled, nextScheduled, sendTest, syncSchedule } from '../../lib/notifications';
import { TIME_KEYS, TIME_LABEL, type TimeKey, TORAQORGON } from '../../lib/prayer-times';
import { saveSettings } from '../../lib/settings';
import { formatDayLong, formatHm, hhmm, isoDay, parseHm } from '../../lib/time';
import { calendarFor } from '../../lib/tracker';
import { applyUpdate, currentVersionInfo, isUpdatesSupported } from '../../lib/updates';
import { type CompareRow, compareWithAladhan } from '../../lib/verify';
import { space } from '../../theme/tokens';
import { Divider, Group, ListRow, Row, ScreenScroll, SectionTitle, Stepper, Toggle, Txt } from '../../ui';

const signed = (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)} daq`);

export default function SettingsScreen() {
  const settings = useSettings();
  const setup = useSetupState();
  const update = useUpdateState();
  const now = useNow(60_000);
  const cal = calendarFor(settings);
  const today = cal.prayerDayAt(now);
  const times = cal.times(today);

  const [scheduled, setScheduled] = useState<{ count: number; next: { title: string; at: Date } | null } | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ rows?: CompareRow[]; error?: string; loading?: boolean } | null>(null);

  const loadScheduled = async () => {
    await syncSchedule();
    setScheduled({ count: await countScheduled(), next: await nextScheduled() });
  };

  useEffect(() => {
    loadScheduled();
  }, [settings]);

  const setAdj = (k: TimeKey, v: number) => saveSettings({ adjustments: { ...settings.adjustments, [k]: v } });

  const runCompare = async () => {
    setCompare({ loading: true });
    try {
      setCompare({ rows: await compareWithAladhan(today, TORAQORGON) });
    } catch (e) {
      setCompare({ error: e instanceof Error ? e.message : 'Ulanib boʻlmadi' });
    }
  };

  const runTest = async () => {
    const r = await sendTest(60);
    setTestMsg(
      r.ok
        ? 'Yuborildi. Ilovani yoping va 1 daqiqa kuting. Kelganda «Oʻqidim ✓» ni bosing — ilova ochilmasligi kerak.'
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

      {/* ── Namoz vaqtlari ── */}
      <SectionTitle>Namoz vaqtlari</SectionTitle>
      <Group>
        <ListRow
          title={TORAQORGON.name}
          hint={`${TORAQORGON.latitude.toFixed(3)}°, ${TORAQORGON.longitude.toFixed(3)}° · islom.uz usuli: 15,5° / 15,5°, Asr Hanafiy, Shom botishdan +4 daq`}
        />
        {TIME_KEYS.map((k) => (
          <View key={k}>
            <Divider inset={space.lg} />
            <ListRow
              title={TIME_LABEL[k]}
              hint={`Bugun ${hhmm(times[k])}`}
              right={<Stepper value={settings.adjustments[k]} min={-30} max={30} onChange={(v) => setAdj(k, v)} format={signed} />}
            />
          </View>
        ))}
      </Group>
      <Txt variant="caption" tone="faint" style={styles.hint}>
        Masjidingiz jadvali bir necha daqiqa farq qilsa — shu yerda moslang. Masalan, namozvaqti.uz Peshinni +4,
        Xuftonni −4 daqiqa koʻrsatadi.
      </Txt>

      <View style={{ height: space.md }} />
      <Group>
        <ListRow
          title="Real API bilan solishtirish"
          hint="Aladhan API'dan bugungi vaqtlarni olib, ilova hisobi bilan taqqoslaydi"
          right={compare?.loading ? '…' : '›'}
          onPress={runCompare}
        />
        {compare?.error && (
          <>
            <Divider inset={space.lg} />
            <ListRow title="Ulanib boʻlmadi" hint={compare.error} tone="danger" />
          </>
        )}
        {compare?.rows && (
          <>
            <Divider inset={space.lg} />
            <View style={styles.compare}>
              <Row style={styles.compareRow}>
                <Txt variant="caption" tone="faint" style={{ flex: 1 }}>
                  {formatDayLong(today)}
                </Txt>
                <Txt variant="caption" tone="faint" style={styles.col}>
                  Ilova
                </Txt>
                <Txt variant="caption" tone="faint" style={styles.col}>
                  API
                </Txt>
                <Txt variant="caption" tone="faint" style={styles.colDiff}>
                  Farq
                </Txt>
              </Row>
              {compare.rows.map((r) => (
                <Row key={r.label} style={styles.compareRow}>
                  <Txt variant="body" style={{ flex: 1 }}>
                    {r.label}
                  </Txt>
                  <Txt variant="body" numeric style={styles.col}>
                    {r.app}
                  </Txt>
                  <Txt variant="body" tone="muted" numeric style={styles.col}>
                    {r.api}
                  </Txt>
                  <Txt variant="label" tone={Math.abs(r.diff) > 1 ? 'danger' : 'faint'} numeric style={styles.colDiff}>
                    {Number.isNaN(r.diff) ? '—' : r.diff === 0 ? '0' : `${r.diff > 0 ? '+' : '−'}${Math.abs(r.diff)}`}
                  </Txt>
                </Row>
              ))}
              <Txt variant="caption" tone="faint" style={{ marginTop: space.sm }}>
                Tuzatishlarsiz formula solishtirildi. ±1 daqiqa — yaxlitlash farqi.
              </Txt>
            </View>
          </>
        )}
      </Group>

      {/* ── Eslatmalar ── */}
      <SectionTitle>Eslatmalar</SectionTitle>
      <Group>
        <ListRow
          title="Eslatmalar"
          hint="Vaqt kirganda va chiqishidan oldin"
          right={<Toggle value={settings.enabled} />}
          onPress={() => saveSettings({ enabled: !settings.enabled })}
        />
        <Divider inset={space.lg} />
        <ListRow
          title="Vaqt tugashidan oldin"
          hint="Belgilanmagan boʻlsa ogohlantiradi"
          right={<Stepper value={settings.warnMinutes} min={10} max={60} step={5} onChange={(v) => saveSettings({ warnMinutes: v })} format={(v) => `${v} daq`} />}
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
        <ListRow
          title="Qazo eslatmasi"
          hint="Qazo qarzi boʻlsa, har kuni"
          right={<Toggle value={settings.qazoReminder} />}
          onPress={() => saveSettings({ qazoReminder: !settings.qazoReminder })}
        />
        {settings.qazoReminder && (
          <>
            <Divider inset={space.lg} />
            <TimeRow title="Qazo vaqti" value={settings.qazoTime} min={0} onChange={(v) => saveSettings({ qazoTime: v })} />
            <Divider inset={space.lg} />
            <ListRow
              title="Kunlik maqsad"
              hint="1 kunlik = har namozdan bittadan (6 ta)"
              right={<Stepper value={settings.qazoDailyDays} min={1} max={10} onChange={(v) => saveSettings({ qazoDailyDays: v })} format={(v) => `${v} kunlik`} />}
            />
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
                ? 'Bildirishnomaga ruxsat berilganini tekshiring'
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
        <Divider inset={space.lg} />
        <ListRow title="Kuzatuv boshlangan" hint="Bundan oldingi namozlar qazoga yozilmaydi" right={formatDayLong(isoDay(new Date(settings.trackingStart)))} />
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
  hint: { paddingHorizontal: space.xl, paddingTop: space.sm, lineHeight: 17 },
  compare: { paddingHorizontal: space.lg, paddingVertical: space.md },
  compareRow: { paddingVertical: 3 },
  col: { width: 56, textAlign: 'right' },
  colDiff: { width: 40, textAlign: 'right' },
});

