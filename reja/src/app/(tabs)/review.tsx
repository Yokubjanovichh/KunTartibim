import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useDataVersion, useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { calendarFor } from '../../lib/calendar';
import { dayNotes, getDayNote, setDayNote } from '../../lib/notes';
import { addDays, formatDayLong, formatDayShort, weekStart } from '../../lib/time';
import { color, hairline, radius, space, type } from '../../theme/tokens';
import { Divider, Group, ScreenScroll, SectionTitle, Txt } from '../../ui';
import { useDayPlan } from '../../ui/DayPlan';
import { TodayClose, TomorrowPlan, WeekPlanStats } from '../../ui/EveningPlan';

/**
 * Tahlil — foydalanuvchi uchun eng muhim boʻlim. Bitta ekran, yuqoridan pastga:
 *   Kun yakuni: bugungi ishlar (qolganini ertaga), odatlar, qisqa xulosa
 *   Ertangi reja: ishlar, ★ asosiylar, uyqu hisobi, [Reja tayyor ✓] va seriya
 *   Hafta: odatlar va reja natijasi, hafta xulosasi
 * Namoz statistikasi — Namozim ilovasida.
 */
export default function ReviewScreen() {
  const now = useNow(30_000);
  const version = useDataVersion();
  const settings = useSettings();
  const cal = calendarFor(settings);
  const today = cal.prayerDayAt(now);
  const wStart = weekStart(today);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notes = useMemo(() => dayNotes(addDays(today, -13), addDays(today, -1)), [today, version]);
  const plan = useDayPlan(today);

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

      {/* ── Bugungi ishlar va odatlar: belgilash, qolganini ertaga oʻtkazish ── */}
      <TodayClose today={today} habits={plan.habits} marks={plan.marks} tasks={plan.tasks} />
      {plan.tasks.length === 0 && plan.habits.length === 0 && (
        <Txt variant="caption" tone="faint" style={styles.empty}>
          Bugunga ish rejalanmagan edi. Ertangi kunni hozirdan rejalang — ertalab maqsad bilan turasiz.
        </Txt>
      )}

      <SectionTitle>Bugungi xulosa</SectionTitle>
      <NoteInput
        key={today}
        noteKey={today}
        placeholder={'Bugun nima yaxshi boʻldi? Nima xalaqit berdi?\nErtaga nimani boshqacha qilasiz?'}
      />

      {/* ── Ertangi reja — kechqurun tuziladi, ertalab maqsad boʻladi ── */}
      <TomorrowPlan today={today} now={now} cal={cal} habits={plan.habits} marks={plan.marks} />

      {/* ── Hafta ── */}
      <View style={styles.weekHead}>
        <Txt variant="overline" tone="faint">
          Bu hafta · {formatDayShort(wStart)} – {formatDayShort(today)}
        </Txt>
      </View>
      <WeekPlanStats wStart={wStart} today={today} habits={plan.habits} marks={plan.marks} />

      <SectionTitle>Hafta xulosasi</SectionTitle>
      <NoteInput key={`week:${wStart}`} noteKey={`week:${wStart}`} placeholder="Bu hafta qanday oʻtdi? Keyingi haftaga bitta niyat." />

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
  header: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.sm },
  empty: { paddingHorizontal: space.xl, paddingTop: space.md, lineHeight: 18 },
  weekHead: { paddingHorizontal: space.xl, paddingTop: space.xxl },
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
