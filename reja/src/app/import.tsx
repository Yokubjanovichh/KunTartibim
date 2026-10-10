import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '../hooks/useData';
import { applyTransfer, parseTransfer, type TransferResult, transferSummary } from '../lib/transfer';
import { formatDayLong, hhmm, isoDay } from '../lib/time';
import { color, hairline, radius, space } from '../theme/tokens';
import { Button, Row, ScreenScroll, Spacer, Tap, Txt } from '../ui';

/**
 * Namozimdan koʻchirish — `kunreja://import?d=<base64url(JSON)>` havolasi shu ekranni ochadi.
 * Avval nima kelganini koʻrsatadi, foydalanuvchi tasdiqlagach yozadi.
 */
export default function ImportScreen() {
  const params = useLocalSearchParams<{ d?: string | string[] }>();
  const raw = Array.isArray(params.d) ? params.d[0] : params.d;
  // Oyna ochiq turganda yangi havola kelsa — natija va xato yangidan boshlanadi
  return <ImportBody key={raw ?? ''} raw={raw} />;
}

function ImportBody({ raw }: { raw: string | undefined }) {
  const parsed = useMemo(() => parseTransfer(raw), [raw]);
  const settings = useSettings();
  const [result, setResult] = useState<TransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const run = () => {
    if (!parsed.ok) return;
    try {
      setResult(applyTransfer(parsed.payload));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScreenScroll withTabBar={false}>
      <Row style={styles.top}>
        <Txt variant="overline" tone="faint">
          Koʻchirish
        </Txt>
        <Tap onPress={close} hitSlop={12}>
          <Txt variant="title" tone="muted">
            ✕
          </Txt>
        </Tap>
      </Row>
      <View style={styles.intro}>
        <Txt variant="title">Namozimdan ishlar va rejalar</Txt>
        <Txt variant="body" tone="muted" style={{ marginTop: space.sm }}>
          Ilova ikkiga boʻlindi: namoz va qazo — Namozimda, kunlik reja — shu yerda. Eski ishlaringiz, odatlar va
          xulosalar shu ilovaga oʻtadi.
        </Txt>
      </View>

      <View style={styles.card}>
        {!parsed.ok ? (
          <>
            <Txt variant="bodyMedium" tone="danger">
              Maʼlumotni oʻqib boʻlmadi
            </Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: space.xs }}>
              {parsed.error}. Namozim → Sozlamalar → «Kun tartibim»ga koʻchirish ni qayta bosing.
            </Txt>
          </>
        ) : result ? (
          <>
            <Txt variant="bodyMedium">Koʻchirildi ✓</Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: space.xs }}>
              {[
                `${result.tasks} ta ish`,
                result.habits ? `${result.habits} ta odat` : null,
                result.notes ? `${result.notes} ta xulosa` : null,
                result.skipped ? `${result.skipped} tasi avval koʻchirilgan edi` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </>
        ) : (
          <>
            <Txt variant="bodyMedium">{transferSummary(parsed.payload)}</Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: space.xs }}>
              Namozimda tayyorlangan: {formatDayLong(isoDay(new Date(parsed.payload.exportedAt)))},{' '}
              {hhmm(new Date(parsed.payload.exportedAt))}
            </Txt>
            {settings.importedAt && (
              <Txt variant="caption" tone="accent" style={{ marginTop: space.sm }}>
                Avval ham koʻchirilgan — takrorlanganlari oʻtkazib yuboriladi.
              </Txt>
            )}
          </>
        )}
        {error && (
          <Txt variant="caption" tone="danger" style={{ marginTop: space.sm }}>
            Yozib boʻlmadi: {error}
          </Txt>
        )}
      </View>

      <View style={styles.actions}>
        {parsed.ok && !result ? (
          <>
            <Button title="Koʻchirish" kind="accent" onPress={run} />
            <Spacer size={space.sm} />
            <Button title="Bekor qilish" kind="secondary" onPress={close} />
          </>
        ) : (
          <Button title={result ? 'Bugungi kunga' : 'Yopish'} kind={result ? 'accent' : 'secondary'} onPress={() => router.replace('/')} />
        )}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.lg },
  intro: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg },
  card: {
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  actions: { paddingHorizontal: space.lg, paddingTop: space.lg },
});
