import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDataVersion, useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { PRAYER_NAME, PRAYERS, type PrayerId } from '../../lib/prayers';
import { dayStatuses, type PrayerStatus, rangeStats } from '../../lib/status';
import { addDays, formatDayLong, formatDayShort, parseDay, weekdayShort, weekStart } from '../../lib/time';
import { calendarFor, getRecords, makeupSince, markPrayer } from '../../lib/tracker';
import { color, hairline, radius, space, type } from '../../theme/tokens';
import { Button, Divider, Group, Progress, Row, ScreenScroll, SectionTitle, Spacer, Tap, Txt } from '../../ui';
import { WakeStats } from '../../ui/WakeStats';
import { pressPrayer } from '../../ui/prayerActions';

const SHORT: Record<PrayerId, string> = { bomdod: 'Bo', peshin: 'Pe', asr: 'As', shom: 'Sh', xufton: 'Xu', vitr: 'Vi' };

/**
 * Tahlil — bitta ekran, yuqoridan pastga:
 *   Bugun: 6 namoz, belgilanmagan Xufton/Vitr uchun tugma
 *   Hafta: namoz jadvali, zaif nuqta, Bomdod vaqtida, uygʻonish jurnali
 *   30 kun: har bir namoz boʻyicha foiz
 * Kun yakuni, ertangi reja va xulosalar — «Kun tartibim» ilovasida.
 */
export default function ReviewScreen() {
  const now = useNow(30_000);
  const version = useDataVersion();
  const settings = useSettings();
  const cal = calendarFor(settings);
  const today = cal.prayerDayAt(now);
  const trackingStart = useMemo(() => new Date(settings.trackingStart), [settings.trackingStart]);

  const wStart = weekStart(today);
  const monthStart = addDays(today, -29);

  /* eslint-disable react-hooks/exhaustive-deps */
  const records = useMemo(() => getRecords(monthStart, today), [monthStart, today, version]);
  const madeUpThisWeek = useMemo(() => makeupSince(parseDay(wStart).toISOString()), [wStart, version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const todayStatus = dayStatuses(cal, today, records, now, trackingStart);
  const week = rangeStats(cal, wStart, today, records, now, trackingStart);
  const month = rangeStats(cal, monthStart, today, records, now, trackingStart);
  const prayedToday = PRAYERS.filter((p) => todayStatus[p] === 'prayed').length;
  const wins = cal.windows(today);

  const weekDays: string[] = [];
  for (let d = wStart; d <= today; d = addDays(d, 1)) weekDays.push(d);

  const weakest = PRAYERS.map((p) => ({ p, n: week.byPrayer[p].qazo }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];

  const pendingNight = (['xufton', 'vitr'] as PrayerId[]).filter((p) => todayStatus[p] === 'active');
  const bomdod = week.byPrayer.bomdod;
  const bomdodTracked = bomdod.prayed + bomdod.qazo;

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Txt variant="overline" tone="faint">
          Tahlil
        </Txt>
        <Txt variant="title" style={{ marginTop: space.xs }}>
          {formatDayLong(today)}
        </Txt>
      </View>

      {/* ── Bugun ── */}
      <View style={styles.todayCells}>
        {PRAYERS.map((p) => (
          <Tap key={p} onPress={() => pressPrayer(today, p, todayStatus[p], wins[p], now)} disabled={todayStatus[p] === 'upcoming'}>
            <View style={styles.bigCell}>
              <Txt variant="caption" tone="faint">
                {PRAYER_NAME[p]}
              </Txt>
              <Glyph status={todayStatus[p]} large />
            </View>
          </Tap>
        ))}
      </View>
      <Txt variant="body" tone="muted" style={styles.pad} numeric>
        {prayedToday}/6 oʻqildi{todayVerdict(todayStatus)}
      </Txt>

      {pendingNight.length > 0 && (
        <View style={[styles.pad, { marginTop: space.md }]}>
          <Button
            title={pendingNight.length === 2 ? 'Xufton va Vitrni oʻqidim' : `${PRAYER_NAME[pendingNight[0]]}ni oʻqidim`}
            kind="accent"
            onPress={() => pendingNight.forEach((p) => markPrayer(today, p, 'prayed', 'review'))}
          />
        </View>
      )}

      {/* ── Hafta ── */}
      <SectionTitle right={<Txt variant="caption" tone="faint">{formatDayShort(wStart)} – {formatDayShort(today)}</Txt>}>
        Bu hafta
      </SectionTitle>
      <Group>
        <Row style={styles.gridHead}>
          <View style={styles.gridDay} />
          {PRAYERS.map((p) => (
            <Txt key={p} variant="caption" tone="faint" style={styles.gridCell}>
              {SHORT[p]}
            </Txt>
          ))}
        </Row>
        {weekDays.map((d) => {
          const st = dayStatuses(cal, d, records, now, trackingStart);
          const w = cal.windows(d);
          return (
            <View key={d}>
              <Divider />
              <Row style={styles.gridRow}>
                <View style={styles.gridDay}>
                  <Txt variant="label" tone={d === today ? 'default' : 'muted'}>
                    {weekdayShort(d)}
                  </Txt>
                  <Txt variant="caption" tone="faint" numeric>
                    {parseDay(d).getDate()}
                  </Txt>
                </View>
                {PRAYERS.map((p) => (
                  <Tap key={p} onPress={() => pressPrayer(d, p, st[p], w[p], now)} disabled={st[p] === 'upcoming'} style={styles.gridCell} haptic={false}>
                    <Glyph status={st[p]} />
                  </Tap>
                ))}
              </Row>
            </View>
          );
        })}
      </Group>

      <View style={[styles.pad, { marginTop: space.md, gap: space.xs }]}>
        <StatLine label="Oʻqildi" value={week.tracked ? `${week.prayed}/${week.tracked} · ${pct(week.prayed, week.tracked)}%` : '—'} />
        <StatLine label="Qazo boʻldi" value={String(week.qazo)} tone={week.qazo ? 'danger' : 'muted'} />
        <StatLine label="Qazosi oʻqildi" value={String(madeUpThisWeek)} />
        <StatLine label="Bomdod vaqtida" value={bomdodTracked ? `${bomdod.prayed}/${bomdodTracked}` : '—'} />
        {weakest && (
          <Txt variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            Zaif nuqta: {PRAYER_NAME[weakest.p]} — bu hafta {weakest.n} marta qazo boʻldi. Uning vaqtiga eʼtibor bering.
          </Txt>
        )}
      </View>

      <WakeStats wStart={wStart} today={today} />

      {/* ── 30 kun ── */}
      <SectionTitle right={<Txt variant="caption" tone="faint" numeric>{month.tracked ? `${pct(month.prayed, month.tracked)}%` : ''}</Txt>}>
        Oxirgi 30 kun
      </SectionTitle>
      <Group style={{ paddingVertical: space.sm }}>
        {PRAYERS.map((p) => {
          const b = month.byPrayer[p];
          const total = b.prayed + b.qazo;
          return (
            <View key={p} style={styles.barRow}>
              <Row>
                <Txt variant="label">{PRAYER_NAME[p]}</Txt>
                <Txt variant="caption" tone={b.qazo ? 'danger' : 'faint'} numeric>
                  {total ? `${b.prayed}/${total}${b.qazo ? ` · ${b.qazo} qazo` : ''}` : 'maʼlumot yoʻq'}
                </Txt>
              </Row>
              <Spacer size={space.sm} />
              <Progress value={total ? b.prayed / total : 0} />
            </View>
          );
        })}
      </Group>
    </ScreenScroll>
  );
}

function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 100) : 0;
}

function todayVerdict(s: Record<PrayerId, PrayerStatus>): string {
  const qazo = PRAYERS.filter((p) => s[p] === 'qazo' || s[p] === 'missed').length;
  const left = PRAYERS.filter((p) => s[p] === 'active' || s[p] === 'upcoming').length;
  if (qazo) return ` · ${qazo} ta qazo`;
  if (left) return ` · ${left} tasi oldinda`;
  return ' · barakalla';
}

function StatLine({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'muted' | 'danger' }) {
  return (
    <Row>
      <Txt variant="body" tone="muted">
        {label}
      </Txt>
      <Txt variant="bodyMedium" tone={tone} numeric>
        {value}
      </Txt>
    </Row>
  );
}

function Glyph({ status, large }: { status: PrayerStatus; large?: boolean }) {
  const map: Record<PrayerStatus, { ch: string; c: string }> = {
    prayed: { ch: '✓', c: color.text },
    qazo: { ch: '✕', c: color.danger },
    missed: { ch: '✕', c: color.danger },
    active: { ch: '●', c: color.accent },
    upcoming: { ch: '·', c: color.textFaint },
    untracked: { ch: '–', c: color.textFaint },
  };
  const g = map[status];
  return (
    <Txt style={[large ? type.numberMd : type.bodyMedium, { color: g.c, textAlign: 'center', marginTop: large ? space.xs : 0 }]}>
      {g.ch}
    </Txt>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.lg },
  pad: { paddingHorizontal: space.xl },
  todayCells: { flexDirection: 'row', paddingHorizontal: space.lg, justifyContent: 'space-between', paddingBottom: space.md },
  bigCell: {
    width: 52,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  gridHead: { paddingHorizontal: space.md, paddingVertical: space.sm },
  gridRow: { paddingHorizontal: space.md, paddingVertical: space.xs, minHeight: 44 },
  gridDay: { width: 44 },
  gridCell: { flex: 1, alignItems: 'center', textAlign: 'center', paddingVertical: space.sm },
  barRow: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
});

