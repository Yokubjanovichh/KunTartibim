import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { BLOCK_LABEL, BLOCKS, type BlockId } from '../lib/blocks';
import { addTask, deleteTask, dropTask, getTask, MAX_PRIORITY, priorityCount, updateTask } from '../lib/plan';
import { addDays, formatDayLong } from '../lib/time';
import { calendarFor } from '../lib/tracker';
import { color, hairline, radius, space, type } from '../theme/tokens';
import { Button, Group, ListRow, Row, ScreenScroll, SectionTitle, Spacer, Tap, Toggle, Txt } from '../ui';
import { Chip } from '../ui/plan';

/**
 * Ish qoʻshish / tahrirlash — bitta ekran. Yozing → (ixtiyoriy) kun va boʻlak → Saqlash.
 * `?id=` — tahrirlash, `?day=` — yangi ish uchun boshlangʻich kun.
 */
export default function TaskScreen() {
  const params = useLocalSearchParams<{ id?: string; day?: string }>();
  const editing = useMemo(() => (params.id ? getTask(Number(params.id)) : null), [params.id]);
  const today = calendarFor().prayerDayAt(new Date());

  const [title, setTitle] = useState(editing?.title ?? '');
  const [day, setDay] = useState<string | null>(editing ? editing.day : (params.day ?? today));
  const [block, setBlock] = useState<BlockId | null>(editing?.block ?? null);
  const [priority, setPriority] = useState(editing?.priority === 1);

  const dayOptions: { label: string; value: string | null }[] = [
    { label: 'Bugun', value: today },
    { label: 'Ertaga', value: addDays(today, 1) },
    { label: 'Indinga', value: addDays(today, 2) },
    { label: 'Keyinroq', value: null },
  ];
  // Tahrirlanayotgan ishning kuni roʻyxatda boʻlmasa (masalan, kecha yoki bir haftadan keyin)
  const extraDay = day && !dayOptions.some((o) => o.value === day) ? day : null;

  const priorityFull = !!day && !priority && priorityCount(day, editing?.id) >= MAX_PRIORITY;
  const canSave = title.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    if (editing) updateTask(editing.id, { title, day, block, priority });
    else addTask({ title, day, block, priority });
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
          <Chip key={o.label} label={o.label} selected={day === o.value} onPress={() => setDay(o.value)} />
        ))}
        {extraDay && <Chip label={formatDayLong(extraDay)} selected onPress={() => setDay(extraDay)} />}
      </View>
      {day === null && (
        <Txt variant="caption" tone="faint" style={styles.hint}>
          Sanasiz ish «Kun yakuni»dagi ertangi rejada koʻrinadi — xohlagan kuni olasiz.
        </Txt>
      )}

      <SectionTitle>Kunning qaysi boʻlagida</SectionTitle>
      <View style={styles.chips}>
        <Chip label="Kun davomida" selected={block === null} onPress={() => setBlock(null)} />
        {BLOCKS.map((b) => (
          <Chip key={b} label={BLOCK_LABEL[b]} selected={block === b} onPress={() => setBlock(b)} />
        ))}
      </View>

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
});
