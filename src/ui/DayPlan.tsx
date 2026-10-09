/**
 * Kun rejasi boʻlimlari — Bugun ekrani uchun.
 *   TopTasks       — kunning asosiy ishlari (★), sahifa tepasida: "ertalab maqsad bilan turish"
 *   OverdueNotice  — oldingi kunlardan qolgan ochiq ishlar → bir bosishda bugunga
 *   AnytimeSection — bloksiz va vaqtsiz ishlar ("Kun davomida")
 *   HabitsSection  — odatlar (faqat foydalanuvchi qoʻshgan boʻlsa koʻrinadi)
 * Blokli ishlar kun tartibida — oʻz namozi ostida chiziladi (app/(tabs)/index.tsx).
 */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useDataVersion } from '../hooks/useData';
import { BLOCK_LABEL, type BlockId } from '../lib/blocks';
import { type Habit, habitMeta, markKey } from '../lib/habits';
import {
  dropTask,
  habitMarks,
  listHabits,
  moveTasks,
  overdueTasks,
  setHabitMark,
  setTaskDone,
  type Task,
  tasksForDay,
} from '../lib/plan';
import type { PrayerId } from '../lib/prayers';
import { addDays, formatDayShort, weekStart } from '../lib/time';
import { space } from '../theme/tokens';
import { Divider, Group, Notice, SectionTitle, Spacer, Tap, Txt } from './index';
import { HabitRow, TaskRow } from './plan';

/** Seriya hisobi uchun qancha kun orqaga qaraladi */
const STREAK_LOOKBACK = 120;

/** Kun tartibida qaysi namozdan keyin qaysi blok ishlari turadi */
export const BLOCK_AFTER: Partial<Record<PrayerId, BlockId>> = {
  bomdod: 'morning',
  peshin: 'noon',
  asr: 'afternoon',
  shom: 'evening',
  vitr: 'night', // Xufton va Vitrdan keyin
};

export function useDayPlan(day: string) {
  const version = useDataVersion();
  /* eslint-disable react-hooks/exhaustive-deps */
  const tasks = useMemo(() => tasksForDay(day), [day, version]);
  const habits = useMemo(() => listHabits(), [version]);
  const marks = useMemo(() => habitMarks(addDays(day, -STREAK_LOOKBACK), day), [day, version]);
  /* eslint-enable react-hooks/exhaustive-deps */
  return { tasks, habits, marks };
}

/** Blok ichida: vaqtlilar vaqt boʻyicha, keyin vaqtsizlar; bajarilganlar joyida qoladi */
export function blockTasks(tasks: Task[], block: BlockId): Task[] {
  return tasks
    .filter((t) => t.block === block)
    .sort((a, b) => {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : a.id - b.id;
      if (a.time) return -1;
      if (b.time) return 1;
      return b.priority - a.priority || a.id - b.id;
    });
}

/* ── Vazifa amallari ──────────────────────────────────────────────────────── */

/**
 * ⚠️ Android Alert koʻpi bilan 3 ta tugma koʻrsatadi (qolganini jimgina tashlaydi)
 * va sukut boʻyicha tashqariga bosib yopilmaydi — shuning uchun ≤3 tugma + cancelable.
 */
export function taskActions(task: Task, day: string) {
  Alert.alert(
    task.title,
    undefined,
    [
      { text: 'Tahrirlash', onPress: () => router.push({ pathname: '/task', params: { id: String(task.id) } }) },
      ...(task.status === 'open' ? [{ text: 'Ertaga', onPress: () => moveTasks([task.id], addDays(day, 1)) }] : []),
      { text: 'Voz kechish', style: 'destructive' as const, onPress: () => dropTask(task.id) },
    ],
    { cancelable: true },
  );
}

/** Ish qatori izohi: vaqt, eslatma, blok, koʻchirishlar */
export function taskMeta(task: Task, opts: { block?: boolean } = {}): string | undefined {
  const parts: string[] = [];
  if (task.time) parts.push(task.remindBefore !== null ? `${task.time} · eslatma` : task.time);
  if (opts.block && task.block && !task.time) parts.push(BLOCK_LABEL[task.block]);
  if (task.movedCount >= 2) parts.push(`${task.movedCount} marta koʻchirildi`);
  return parts.length ? parts.join(' · ') : undefined;
}

/* ── Asosiy ishlar ────────────────────────────────────────────────────────── */

export function TopTasks({ day, tasks }: { day: string; tasks: Task[] }) {
  const top = tasks.filter((t) => t.priority === 1);
  if (!top.length) return null;
  const done = top.filter((t) => t.status === 'done').length;
  return (
    <>
      <SectionTitle right={<Txt variant="caption" tone="faint" numeric>{done}/{top.length}</Txt>}>Bugungi asosiy</SectionTitle>
      <Group>
        {top.map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider inset={space.xxxl} />}
            <TaskRow
              task={t}
              meta={taskMeta(t, { block: true })}
              onToggle={() => setTaskDone(t.id, t.status !== 'done')}
              onLongPress={() => taskActions(t, day)}
            />
          </View>
        ))}
      </Group>
      <Spacer size={space.md} />
    </>
  );
}

/* ── Oldingi kunlardan qolganlar ──────────────────────────────────────────── */

export function OverdueNotice({ day }: { day: string }) {
  const version = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overdue = useMemo(() => overdueTasks(day), [day, version]);
  if (!overdue.length) return null;
  return (
    <>
      <Notice
        title={`Oldingi kunlardan ${overdue.length} ta ish qolgan`}
        hint={overdue
          .slice(0, 3)
          .map((t) => `${t.title} (${formatDayShort(t.day!)})`)
          .join(', ')}
        action="Bugunga"
        onPress={() => moveTasks(overdue.map((t) => t.id), day)}
      />
      <Spacer size={space.md} />
    </>
  );
}

/* ── Kun davomida (bloksiz ishlar) ────────────────────────────────────────── */

export function AnytimeSection({ day, tasks, isCurrent }: { day: string; tasks: Task[]; isCurrent: boolean }) {
  // Bloksiz asosiy ishlar tepadagi "Bugungi asosiy" da — ikki marta koʻrsatmaymiz
  const items = tasks.filter((t) => t.block === null && t.priority !== 1);
  const scheduled = tasks.some((t) => t.block !== null);
  if (!items.length) {
    return tasks.length === 0 ? (
      <Txt variant="caption" tone="faint" style={styles.empty}>
        {isCurrent
          ? 'Bugunga ish rejalanmagan. «+ Ish qoʻshish» — yoki kechqurun «Kun yakuni»da ertangi kunni rejalang.'
          : 'Bu kunga ish rejalanmagan edi.'}
      </Txt>
    ) : null;
  }
  return (
    <>
      <SectionTitle>{scheduled ? 'Kun davomida' : 'Ishlar'}</SectionTitle>
      <Group>
        {items.map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider inset={space.xxxl} />}
            <TaskRow task={t} meta={taskMeta(t)} onToggle={() => setTaskDone(t.id, t.status !== 'done')} onLongPress={() => taskActions(t, day)} />
          </View>
        ))}
      </Group>
    </>
  );
}

/* ── Odatlar ──────────────────────────────────────────────────────────────── */

export function habitLongPress(h: Habit, day: string, state: boolean | undefined) {
  Alert.alert(
    h.title,
    undefined,
    [
      ...(state !== false
        ? [{ text: h.kind === 'avoid' ? 'Tiyila olmadim' : 'Bajarilmadi', onPress: () => setHabitMark(h.id, day, false) }]
        : []),
      ...(state !== undefined ? [{ text: 'Belgini olib tashlash', onPress: () => setHabitMark(h.id, day, null) }] : []),
      { text: 'Tahrirlash', onPress: () => router.push('/habits') },
    ],
    { cancelable: true },
  );
}

/** Odatlar — foydalanuvchi qoʻshmaguncha koʻrinmaydi (Sozlamalar → Odatlar) */
export function HabitsSection({
  day,
  habits,
  marks,
}: {
  day: string;
  habits: Habit[];
  marks: ReadonlyMap<string, boolean>;
}) {
  if (!habits.length) return null;
  const wStart = weekStart(day);
  return (
    <>
      <SectionTitle
        right={
          <Tap onPress={() => router.push('/habits')} hitSlop={10}>
            <Txt variant="label" tone="faint">
              Tahrirlash
            </Txt>
          </Tap>
        }>
        Odatlar
      </SectionTitle>
      <Group>
        {habits.map((h, i) => {
          const state = marks.get(markKey(h.id, day));
          return (
            <View key={h.id}>
              {i > 0 && <Divider inset={space.xxxl} />}
              <HabitRow
                habit={h}
                state={state}
                meta={habitMeta(h, marks, wStart, day)}
                onPress={() => setHabitMark(h.id, day, state === true ? null : true)}
                onLongPress={() => habitLongPress(h, day, state)}
              />
            </View>
          );
        })}
      </Group>
    </>
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: space.xl, paddingTop: space.lg, lineHeight: 18 },
});
