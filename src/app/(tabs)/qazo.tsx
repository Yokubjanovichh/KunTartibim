import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useDataVersion, useSettings } from '../../hooks/useData';
import { PRAYER_NAME, PRAYERS } from '../../lib/prayers';
import { formatDayShort, isoDay } from '../../lib/time';
import {
  deleteEntry,
  makeup,
  makeupDays,
  markPrayer,
  qazoBalances,
  recentEntries,
  recentQazo,
} from '../../lib/tracker';
import { space } from '../../theme/tokens';
import { Badge, Button, Divider, Empty, Group, ListRow, Row, ScreenScroll, SectionTitle, Spacer, Tap, Txt } from '../../ui';

const KIND_LABEL = { old: 'eski qazo qoʻshildi', makeup: 'qazosi oʻqildi', correction: 'tuzatish' } as const;

export default function QazoScreen() {
  const version = useDataVersion();
  const settings = useSettings();
  /* eslint-disable react-hooks/exhaustive-deps */
  const balances = useMemo(() => qazoBalances(), [version]);
  const missedList = useMemo(() => recentQazo(30), [version]);
  const entries = useMemo(() => recentEntries(8), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const goal = settings.qazoDailyDays;
  // 1 kunlik = har bir namozdan bittadan → eng koʻp qolgan namoz muddatni belgilaydi
  const daysLeft = Math.max(0, ...PRAYERS.map((p) => Math.ceil(balances[p] / goal)));

  const doMakeupDay = () => {
    const n = makeupDays(goal);
    if (n > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confirmPrayed = (day: string, prayer: (typeof PRAYERS)[number]) => {
    Alert.alert(`${PRAYER_NAME[prayer]} · ${formatDayShort(day)}`, 'Bu namozni vaqtida oʻqiganmisiz?', [
      { text: 'Yoʻq', style: 'cancel' },
      { text: 'Ha, oʻqigandim', onPress: () => markPrayer(day, prayer, 'prayed', 'review') },
    ]);
  };

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Txt variant="overline" tone="faint">
          Qazo namozlar
        </Txt>
        {balances.total > 0 ? (
          <>
            <Txt variant="display" tone="danger" numeric style={{ marginTop: space.sm }}>
              {balances.total}
            </Txt>
            <Txt variant="body" tone="muted" style={{ marginTop: space.xs }}>
              Kuniga {goal} kunlikdan — taxminan {daysLeft} kunda tugaydi
            </Txt>
            <Spacer size={space.lg} />
            <Button title={`${goal} kunlik qazo oʻqidim`} kind="primary" onPress={doMakeupDay} />
          </>
        ) : (
          <>
            <Txt variant="display" tone="muted" style={{ marginTop: space.sm }}>
              0
            </Txt>
            <Txt variant="body" tone="muted" style={{ marginTop: space.xs }}>
              Qazo yoʻq. Alloh qabul qilsin.
            </Txt>
          </>
        )}
      </View>

      <SectionTitle>Namozlar boʻyicha</SectionTitle>
      <Group>
        {PRAYERS.map((p, i) => (
          <View key={p}>
            {i > 0 && <Divider inset={space.lg} />}
            <Row style={styles.row}>
              <Txt variant="bodyMedium" style={{ flex: 1 }}>
                {PRAYER_NAME[p]}
              </Txt>
              <Txt variant="numberMd" tone={balances[p] > 0 ? 'default' : 'faint'} numeric style={styles.count}>
                {balances[p]}
              </Txt>
              <Button title="−1" kind="secondary" compact disabled={balances[p] === 0} onPress={() => makeup(p, 1)} />
            </Row>
          </View>
        ))}
      </Group>
      <Txt variant="caption" tone="faint" style={styles.hint}>
        «−1» — shu namozning bitta qazosini oʻqidingiz.
      </Txt>

      <Spacer size={space.lg} />
      <Group>
        <ListRow
          title="Eski qazolarni qoʻshish"
          hint="Ilovadan oldingi davr: yillar, oylar yoki aniq son"
          right="›"
          onPress={() => router.push('/qazo-add')}
        />
      </Group>

      <SectionTitle>Oxirgi qazolar</SectionTitle>
      {missedList.length === 0 ? (
        <Empty title="Hali qazo yoʻq" hint="Vaqti chiqqan va belgilanmagan namoz shu yerga tushadi" />
      ) : (
        <Group>
          {missedList.map((r, i) => (
            <View key={`${r.day}:${r.prayer}`}>
              {i > 0 && <Divider inset={space.lg} />}
              <Tap onPress={() => confirmPrayed(r.day, r.prayer)} scaleTo={0.985}>
                <Row style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="body">{PRAYER_NAME[r.prayer]}</Txt>
                    <Txt variant="caption" tone="faint" numeric>
                      {formatDayShort(r.day)} · {r.source === 'auto' ? 'belgilanmagan' : 'qazo deb belgilangan'}
                    </Txt>
                  </View>
                  <Txt variant="label" tone="muted">
                    Aslida oʻqigandim
                  </Txt>
                </Row>
              </Tap>
            </View>
          ))}
        </Group>
      )}

      {entries.length > 0 && (
        <>
          <SectionTitle>Oxirgi amallar</SectionTitle>
          <Group>
            {entries.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Divider inset={space.lg} />}
                <Row style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Row style={{ justifyContent: 'flex-start', gap: space.sm }}>
                      <Txt variant="body">{PRAYER_NAME[e.prayer]}</Txt>
                      <Badge tone={e.delta > 0 ? 'danger' : 'default'}>{e.delta > 0 ? `+${e.delta}` : `${e.delta}`}</Badge>
                    </Row>
                    <Txt variant="caption" tone="faint" numeric>
                      {KIND_LABEL[e.kind]} · {formatDayShort(isoDay(new Date(e.createdAt)))}
                    </Txt>
                  </View>
                  {e.kind !== 'correction' && (
                    <Tap
                      onPress={() =>
                        Alert.alert('Bekor qilinsinmi?', `${PRAYER_NAME[e.prayer]}: ${KIND_LABEL[e.kind]} (${e.delta > 0 ? '+' : ''}${e.delta})`, [
                          { text: 'Yoʻq', style: 'cancel' },
                          { text: 'Bekor qilish', style: 'destructive', onPress: () => deleteEntry(e.id) },
                        ])
                      }
                      hitSlop={8}>
                      <Txt variant="label" tone="faint">
                        Bekor qilish
                      </Txt>
                    </Tap>
                  )}
                </Row>
              </View>
            ))}
          </Group>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.md },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56, gap: space.md },
  count: { minWidth: 48, textAlign: 'right' },
  hint: { paddingHorizontal: space.xl, paddingTop: space.sm },
});
