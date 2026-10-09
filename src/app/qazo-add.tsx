import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { PRAYER_NAME, PRAYERS, type PrayerId } from '../lib/prayers';
import { addOldQazo } from '../lib/tracker';
import { color, hairline, radius, space, type } from '../theme/tokens';
import { Button, Divider, Group, ListRow, Row, ScreenScroll, SectionTitle, Spacer, Stepper, Tap, Txt } from '../ui';

/**
 * Eski qazolar — bitta ekranda: davrni kiriting, har namozga nechta qoʻshilishi
 * darhol koʻrinadi; xohlasangiz har birini alohida tuzatasiz.
 * 1 yil = 365 kun. Qamariy yil (354 kun) olinsa son kamroq chiqadi — ehtiyot uchun
 * quyosh yili olingan; foydalanuvchi har namoz sonini baribir qoʻlda tuzata oladi.
 */
export default function QazoAddScreen() {
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(0);
  const [days, setDays] = useState(0);
  const [overrides, setOverrides] = useState<Partial<Record<PrayerId, string>>>({});

  const fromPeriod = years * 365 + months * 30 + days;
  const valueFor = (p: PrayerId): number => {
    const o = overrides[p];
    if (o === undefined) return fromPeriod;
    const n = Number(o.replace(/\s/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  const total = PRAYERS.reduce((s, p) => s + valueFor(p), 0);

  const save = () => {
    const per: Partial<Record<PrayerId, number>> = {};
    for (const p of PRAYERS) per[p] = valueFor(p);
    addOldQazo(per);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScreenScroll withTabBar={false}>
      <Row style={styles.top}>
        <Txt variant="overline" tone="faint">
          Eski qazolar
        </Txt>
        <Tap onPress={() => router.back()} hitSlop={12}>
          <Txt variant="title" tone="muted">
            ✕
          </Txt>
        </Tap>
      </Row>
      <View style={styles.intro}>
        <Txt variant="title">Ilovadan oldingi qazolar</Txt>
        <Txt variant="body" tone="muted" style={{ marginTop: space.sm }}>
          Namoz oʻqilmagan davrni kiriting. Har bir namozga (Vitr bilan) shuncha qazo qoʻshiladi.
        </Txt>
      </View>

      <SectionTitle>Davr</SectionTitle>
      <Group>
        <ListRow title="Yil" right={<Stepper value={years} min={0} max={60} onChange={setYears} />} />
        <Divider inset={space.lg} />
        <ListRow title="Oy" right={<Stepper value={months} min={0} max={11} onChange={setMonths} />} />
        <Divider inset={space.lg} />
        <ListRow title="Kun" right={<Stepper value={days} min={0} max={30} step={1} onChange={setDays} />} />
      </Group>
      <Txt variant="caption" tone="faint" style={styles.hint} numeric>
        {fromPeriod} kun → har namozga {fromPeriod} ta. 1 yil = 365 kun, 1 oy = 30 kun.
      </Txt>

      <SectionTitle>Namozlar boʻyicha (tuzatish mumkin)</SectionTitle>
      <Group>
        {PRAYERS.map((p, i) => (
          <View key={p}>
            {i > 0 && <Divider inset={space.lg} />}
            <Row style={styles.row}>
              <Txt variant="body" style={{ flex: 1 }}>
                {PRAYER_NAME[p]}
              </Txt>
              <TextInput
                value={overrides[p] ?? String(fromPeriod)}
                onChangeText={(t) => setOverrides((o) => ({ ...o, [p]: t.replace(/[^\d]/g, '') }))}
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.input}
                cursorColor={color.accent}
              />
            </Row>
          </View>
        ))}
      </Group>
      {Object.keys(overrides).length > 0 && (
        <Tap onPress={() => setOverrides({})} style={{ alignSelf: 'flex-start' }}>
          <Txt variant="caption" tone="accent" style={styles.hint}>
            Davr boʻyicha qaytarish
          </Txt>
        </Tap>
      )}

      <Spacer size={space.xl} />
      <View style={{ paddingHorizontal: space.lg }}>
        <Button title={total > 0 ? `${total} ta qazoni qoʻshish` : 'Qoʻshish'} kind="primary" disabled={total === 0} onPress={save} />
        <Txt variant="caption" tone="faint" style={{ marginTop: space.sm, textAlign: 'center' }}>
          Xato kiritilsa, Qazo ekranidagi «Oxirgi amallar» dan bekor qilinadi.
        </Txt>
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.lg },
  intro: { paddingHorizontal: space.xl, paddingTop: space.md },
  hint: { paddingHorizontal: space.xl, paddingTop: space.sm },
  row: { paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 52 },
  input: {
    ...type.numberMd,
    color: color.text,
    minWidth: 96,
    textAlign: 'right',
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surfaceHigh,
  },
});
