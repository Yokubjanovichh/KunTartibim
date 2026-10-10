/**
 * Uygʻonish jurnali — har tong Bomdod budilnigi qachon chalindi va qachon "Turdim"
 * bosildi (native modul jurnalidan). Tahlil ekranida hafta jadvali ostida.
 */

import { StyleSheet, View } from 'react-native';

import { alarmSupported, wakeLog, type WakeLogEntry } from '../lib/alarm';
import { addDays, hhmm, isoDay, weekdayShort } from '../lib/time';
import { space } from '../theme/tokens';
import { Divider, Group, Row, SectionTitle, Txt } from './index';

/**
 * Har tong budilnik qachon chalindi va qachon "Turdim" bosildi — native modul
 * jurnalidan. Kech yotish → kech turish bogʻliqligini koʻrish uchun.
 */
export function WakeStats({ wStart, today }: { wStart: string; today: string }) {
  if (!alarmSupported) return null;
  // Native jurnal ilova tashqarisida (budilnik paytida) yoziladi — har chizishda yangidan oʻqiymiz
  const week = wakeLog()
    .filter((e) => {
      const d = isoDay(new Date(e.at));
      return d >= wStart && d <= addDays(today, 1);
    })
    .sort((a, b) => a.at - b.at);
  if (!week.length) return null;

  const awake = (e: WakeLogEntry) => e.dismissedAt > 0 && !e.asleep;
  const woke = week.filter(awake);
  const avgSnooze = week.reduce((s, e) => s + e.snoozes, 0) / week.length;

  return (
    <>
      <SectionTitle right={<Txt variant="caption" tone="faint" numeric>{woke.length}/{week.length} turildi</Txt>}>
        Uygʻonish
      </SectionTitle>
      <Group>
        {week.map((e, i) => {
          const day = isoDay(new Date(e.at));
          const parts = [
            !e.dismissedAt
              ? 'javobsiz tugadi'
              : e.asleep
                ? `${hhmm(new Date(e.dismissedAt))} da turdi, lekin qayta uxlab qoldi`
                : `${hhmm(new Date(e.dismissedAt))} da turdi`,
            e.snoozes ? `${e.snoozes} marta keyinga surildi` : null,
            e.rechecked && !e.asleep ? 'tekshiruvdan keyin qayta chaldi' : null,
          ].filter(Boolean);
          return (
            <View key={`${e.at}`}>
              {i > 0 && <Divider inset={space.lg} />}
              <Row style={styles.wakeRow}>
                <Txt variant="label" tone="muted" style={{ width: 64 }}>
                  {weekdayShort(day)} {Number(day.slice(8))}
                </Txt>
                <Txt variant="body" tone={awake(e) ? 'default' : 'danger'} style={{ flex: 1 }} numeric>
                  {parts.join(' · ')}
                </Txt>
              </Row>
            </View>
          );
        })}
      </Group>
      {avgSnooze >= 1 && (
        <Txt variant="caption" tone="muted" style={[styles.pad, { marginTop: space.sm }]}>
          Har tong oʻrtacha {avgSnooze.toFixed(1).replace('.', ',')} marta keyinga surilyapti — telefonni karavotdan uzoqroqqa qoʻyib koʻring.
        </Txt>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.xl },
  wakeRow: { paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: 'flex-start', gap: space.md },
});
