import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { BLOCK_LABEL, BLOCKS, type BlockId, blockForTime, currentBlock } from '../lib/blocks';
import { addTask, deleteTask, dropTask, getTask, MAX_PRIORITY, priorityCount, updateTask } from '../lib/plan';
import { addDays, formatDayLong, formatHm, parseHm } from '../lib/time';
import { calendarFor } from '../lib/calendar';
import { color, hairline, radius, space, type } from '../theme/tokens';
import { Button, Group, ListRow, Row, ScreenScroll, SectionTitle, Spacer, Tap, Toggle, Txt } from '../ui';
import { Chip } from '../ui/plan';

/** Soatlar kun oqimi tartibida: Bomdoddan keyingi tongdan tungacha */
const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4];
const MINUTES = [0, 10, 15, 20, 30, 40, 45, 50];
const REMIND: { label: string; value: number | null }[] = [
  { label: 'Eslatmasiz', value: null },
  { label: 'Vaqtida', value: 0 },
  { label: '15 daq oldin', value: 15 },
  { label: '30 daq oldin', value: 30 },
  { label: '1 soat oldin', value: 60 },
];

/**
 * Ish qoʻshish / tahrirlash — bitta ekran. Yozing → (ixtiyoriy) kun, boʻlak yoki
 * aniq vaqt → Saqlash. `?id=` — tahrirlash; `?day=`, `?block=` — yangi ish uchun.
 */
export default function TaskScreen() {
  const params = useLocalSearchParams<{ id?: string; day?: string; block?: string }>();
  const editing = useMemo(() => (params.id ? getTask(Number(params.id)) : null), [params.id]);
  const cal = calendarFor();
  const now = new Date();
  const today = cal.prayerDayAt(now);

  const initialDay = editing ? editing.day : (params.day ?? today);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [day, setDay] = useState<string | null>(initialDay);
  const [block, setBlock] = useState<BlockId | null>(() => {
    if (editing) return editing.block;
    if (params.block && (BLOCKS as readonly string[]).includes(params.block)) return params.block as BlockId;
    // Bugungi yangi ish — hozirgi blokka (odatda "hozir qilaman" degani)
    return initialDay === today ? currentBlock(cal.times(today), now) : null;
  });
  const [time, setTime] = useState<string | null>(editing?.time ?? null);
  const [remind, setRemind] = useState<number | null>(editing ? editing.remindBefore : 0);
  const [priority, setPriority] = useState(editing?.priority === 1);

  const dayOptions: { label: string; value: string | null }[] = [
    { label: 'Bugun', value: today },
    { label: 'Ertaga', value: addDays(today, 1) },
    { label: 'Indinga', value: addDays(today, 2) },
    { label: 'Keyinroq', value: null },
  ];
  const extraDay = day && !dayOptions.some((o) => o.value === day) ? day : null;

  const minutes = time ? (parseHm(time) ?? 0) : null;
  const hour = minutes === null ? null : Math.floor(minutes / 60);
  const minute = minutes === null ? null : minutes % 60;
  const derivedBlock = time && day ? blockForTime(cal.times(day), day, time) : null;

  const priorityFull = !!day && !priority && priorityCount(day, editing?.id) >= MAX_PRIORITY;
  const canSave = title.trim().length > 0;

  const enableTime = () => {
    // Bugun boʻlsa — keyingi butun soat, boshqa kun — 09:00
    const h = day === today ? (now.getHours() + 1) % 24 : 9;
    setTime(formatHm(h * 60));
    if (remind === null && !editing) setRemind(0);
  };

  const chooseDay = (value: string | null) => {
    setDay(value);
    if (value === null) setTime(null); // sanasiz ishda vaqt maʼnosiz
  };

  const save = () => {
    if (!canSave) return;
    const input = {
      title,
      day,
      block: derivedBlock ?? block,
      time: day ? time : null,
      remindBefore: day && time ? remind : null,
      priority,
    };
    if (editing) updateTask(editing.id, input);
    else addTask(input);
    router.back();
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert('Bu ish nima boʻlsin?', editing.title, [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'Voz kechdim',
        onPress: () => {
          dropTask(editing.id);
          router.back();
        },
      },
      {
        text: 'Oʻchirish',
        style: 'destructive',
        onPress: () => {
          deleteTask(editing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenScroll withTabBar={false}>
      <Row style={styles.top}>
        <Txt variant="overline" tone="faint">
          {editing ? 'Ishni tahrirlash' : 'Yangi ish'}
        </Txt>
        <Tap onPress={() => router.back()} hitSlop={12}>
          <Txt variant="title" tone="muted">
            ✕
          </Txt>
        </Tap>
      </Row>

      <View style={styles.inputBox}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nima qilish kerak?"
          placeholderTextColor={color.textFaint}
          autoFocus={!editing}
          returnKeyType="done"
          onSubmitEditing={save}
          style={styles.input}
          cursorColor={color.accent}
          selectionColor={color.accentMuted}
        />
      </View>

      <SectionTitle>Qachon</SectionTitle>
      <View style={styles.chips}>
        {dayOptions.map((o) => (
          <Chip key={o.label} label={o.label} selected={day === o.value} onPress={() => chooseDay(o.value)} />
        ))}
        {extraDay && <Chip label={formatDayLong(extraDay)} selected onPress={() => chooseDay(extraDay)} />}
      </View>
      {day === null && (
        <Txt variant="caption" tone="faint" style={styles.hint}>
          Sanasiz ish «Kun yakuni»dagi ertangi rejada koʻrinadi — xohlagan kuni olasiz.
        </Txt>
      )}

      {day !== null && (
        <>
          <SectionTitle
            right={
              time ? (
                <Tap onPress={() => setTime(null)} hitSlop={10}>
                  <Txt variant="label" tone="faint">
                    Vaqtni olib tashlash
                  </Txt>
                </Tap>
              ) : undefined
            }>
            Aniq vaqt
          </SectionTitle>
          {time === null ? (
            <View style={styles.chips}>
              <Chip label="Vaqtsiz — namoz bloki yetarli" selected onPress={() => {}} />
              <Chip label="Vaqt belgilash" selected={false} onPress={enableTime} />
            </View>
          ) : (
            <View style={styles.timeBox}>
              <Row style={{ justifyContent: 'flex-start', alignItems: 'baseline', gap: space.md }}>
                <Txt variant="display" numeric>
                  {time}
                </Txt>
                {derivedBlock && (
                  <Txt variant="caption" tone="faint">
                    {BLOCK_LABEL[derivedBlock]}
                  </Txt>
                )}
              </Row>
              <Txt variant="caption" tone="faint" style={styles.label}>
                Soat
              </Txt>
              <View style={styles.grid}>
                {HOURS.map((h) => (
                  <Chip key={h} label={String(h).padStart(2, '0')} selected={hour === h} onPress={() => setTime(formatHm(h * 60 + (minute ?? 0)))} />
                ))}
              </View>
              <Txt variant="caption" tone="faint" style={styles.label}>
                Daqiqa
              </Txt>
              <View style={styles.grid}>
                {MINUTES.map((m) => (
                  <Chip key={m} label={`:${String(m).padStart(2, '0')}`} selected={minute === m} onPress={() => setTime(formatHm((hour ?? 9) * 60 + m))} />
                ))}
              </View>
              <Txt variant="caption" tone="faint" style={styles.label}>
                Eslatma
              </Txt>
              <View style={styles.grid}>
                {REMIND.map((r) => (
                  <Chip key={r.label} label={r.label} selected={remind === r.value} onPress={() => setRemind(r.value)} />
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {!time && (
        <>
          <SectionTitle>Kunning qaysi boʻlagida</SectionTitle>
          <View style={styles.chips}>
            <Chip label="Kun davomida" selected={block === null} onPress={() => setBlock(null)} />
            {BLOCKS.map((b) => (
              <Chip key={b} label={BLOCK_LABEL[b]} selected={block === b} onPress={() => setBlock(b)} />
            ))}
          </View>
        </>
      )}

      <Spacer size={space.lg} />
      <Group>
        <ListRow
          title="★ Asosiy ish"
          hint={
            day === null
              ? 'Sanasiz ish asosiy boʻla olmaydi — avval kunini tanlang'
              : priorityFull
                ? `Bu kunda ${MAX_PRIORITY} ta asosiy ish bor — hammasi asosiy boʻlsa, hech biri asosiy emas`
                : 'Kunning eng muhimi. Ertalab Bomdod eslatmasida koʻrinadi'
          }
          right={<Toggle value={priority && day !== null} />}
          onPress={() => (priorityFull || day === null ? undefined : setPriority(!priority))}
          tone={priorityFull || day === null ? 'faint' : 'default'}
        />
      </Group>

      <Spacer size={space.xl} />
      <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
        <Button title={editing ? 'Saqlash' : 'Qoʻshish'} kind="primary" disabled={!canSave} onPress={save} />
        {editing && <Button title="Voz kechish yoki oʻchirish" kind="danger" onPress={remove} />}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md },
  inputBox: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  input: { ...type.title, color: color.text, paddingHorizontal: space.lg, paddingVertical: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg },
  hint: { paddingHorizontal: space.xl, paddingTop: space.sm },
  timeBox: {
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  label: { marginTop: space.md, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
});
