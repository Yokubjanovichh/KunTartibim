import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useDataVersion, useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { PRAYER_NAME, PRAYERS, type PrayerId } from '../../lib/prayers';
import { dayStatuses, type PrayerStatus, rangeStats } from '../../lib/status';
import { addDays, formatDayLong, formatDayShort, parseDay, weekdayShort, weekStart } from '../../lib/time';
import { calendarFor, dayNotes, getDayNote, getRecords, makeupSince, markPrayer, setDayNote } from '../../lib/tracker';
import { color, hairline, radius, space, type } from '../../theme/tokens';
import { Button, Divider, Group, Progress, Row, ScreenScroll, SectionTitle, Spacer, Tap, Txt } from '../../ui';
import { pressPrayer } from '../../ui/prayerActions';

const SHORT: Record<PrayerId, string> = { bomdod: 'Bo', peshin: 'Pe', asr: 'As', shom: 'Sh', xufton: 'Xu', vitr: 'Vi' };

/**
 * Tahlil — foydalanuvchi uchun eng muhim boʻlim.
 *   Kun yakuni: bugungi 6 namoz + qisqa xulosa (nima yaxshi boʻldi, nima xalaqit berdi)
 *   Hafta: jadval, zaif nuqta (qaysi namoz koʻp qazo boʻlyapti), haftalik xulosa
 *   30 kun: har bir namoz boʻyicha foiz
 * 2-bosqichda bu yerga vazifalar tahlili qoʻshiladi.
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
  const notes = useMemo(() => dayNotes(addDays(today, -13), addDays(today, -1)), [today, version]);
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

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Txt variant="overline" tone="faint">
          Kun yakuni
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

      <SectionTitle>Bugungi xulosa</SectionTitle>
      <NoteInput
        key={today}
        noteKey={today}
        placeholder={'Bugun nima yaxshi boʻldi? Nima xalaqit berdi?\nErtaga nimani boshqacha qilasiz?'}
      />

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
        {weakest && (
          <Txt variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            Zaif nuqta: {PRAYER_NAME[weakest.p]} — bu hafta {weakest.n} marta qazo boʻldi. Uning vaqtiga eʼtibor bering.
          </Txt>
        )}
      </View>

      <SectionTitle>Hafta xulosasi</SectionTitle>
      <NoteInput key={`week:${wStart}`} noteKey={`week:${wStart}`} placeholder="Bu hafta qanday oʻtdi? Keyingi haftaga bitta niyat." />

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

      {notes.length > 0 && (
        <>
          <SectionTitle>Oldingi xulosalar</SectionTitle>
          <Group>
            {notes.map((n, i) => (
              <View key={n.day}>
                {i > 0 && <Divider inset={space.lg} />}
                <View style={styles.noteRow}>
                  <Txt variant="caption" tone="faint">
                    {formatDayLong(n.day)}
                  </Txt>
                  <Txt variant="body" style={{ marginTop: 2 }}>
                    {n.text}
                  </Txt>
                </View>
              </View>
            ))}
          </Group>
        </>
      )}
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

/** Xulosa — yozish toʻxtagach 0,8 s da va maydondan chiqqanda saqlanadi */
function NoteInput({ noteKey, placeholder }: { noteKey: string; placeholder: string }) {
  const [text, setText] = useState(() => getDayNote(noteKey));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);
  latest.current = text;

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        setDayNote(noteKey, latest.current);
      }
    },
    [noteKey],
  );

  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDayNote(noteKey, latest.current);
  };

  return (
    <View style={styles.noteBox}>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, 800);
        }}
        onBlur={save}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        multiline
        style={styles.noteInput}
        cursorColor={color.accent}
        selectionColor={color.accentMuted}
      />
    </View>
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
  noteBox: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  noteInput: {
    ...type.body,
    color: color.text,
    minHeight: 88,
    padding: space.lg,
    textAlignVertical: 'top',
  },
  noteRow: { paddingHorizontal: space.lg, paddingVertical: space.md },
});

