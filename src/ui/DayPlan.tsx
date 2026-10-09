/**
 * Kun rejasi boʻlimlari — Bugun ekrani uchun.
 *   TopTasks     — kunning asosiy ishlari (★), sahifa tepasida: "ertalab maqsad bilan turish"
 *   PlanSection  — qolgan ishlar namoz bloklari boʻyicha + oldingi kunlardan qolganlar
 *   HabitsSection — odatlar: bosish = belgilash, uzoq bosish = boshqa holatlar
 */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useDataVersion } from '../hooks/useData';
import { BLOCK_LABEL, BLOCKS, type BlockId, blockStart, currentBlock } from '../lib/blocks';
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
import type { DayTimes } from '../lib/prayer-times';
import { addDays, formatDayShort, hhmm, weekStart } from '../lib/time';
import { space } from '../theme/tokens';
import { Divider, Group, Notice, Row, SectionTitle, Spacer, Tap, Txt } from './index';
import { HabitRow, TaskRow } from './plan';

/** Seriya hisobi uchun qancha kun orqaga qaraladi */
const STREAK_LOOKBACK = 120;

export function useDayPlan(day: string) {
  const version = useDataVersion();
  /* eslint-disable react-hooks/exhaustive-deps */
  const tasks = useMemo(() => tasksForDay(day), [day, version]);
  const habits = useMemo(() => listHabits(), [version]);
  const marks = useMemo(() => habitMarks(addDays(day, -STREAK_LOOKBACK), day), [day, version]);
  /* eslint-enable react-hooks/exhaustive-deps */
  return { tasks, habits, marks };
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

function taskMeta(task: Task, withBlock: boolean): string | undefined {
  const parts: string[] = [];
  if (withBlock && task.block) parts.push(BLOCK_LABEL[task.block]);
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
              meta={taskMeta(t, true)}
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

/* ── Reja (bloklar boʻyicha) ──────────────────────────────────────────────── */

export function PlanSection({
  day,
  tasks,
  times,
  now,
  isCurrent,
}: {
  day: string;
  tasks: Task[];
  times: DayTimes;
  now: Date;
  isCurrent: boolean;
}) {
  const version = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overdue = useMemo(() => (isCurrent ? overdueTasks(day) : []), [day, isCurrent, version]);
  const rest = tasks.filter((t) => t.priority !== 1);
  const nowBlock = isCurrent ? currentBlock(times, now) : null;

  const groups: { block: BlockId | null; items: Task[] }[] = [
    ...BLOCKS.map((b) => ({ block: b as BlockId | null, items: rest.filter((t) => t.block === b) })),
    { block: null, items: rest.filter((t) => t.block === null) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <SectionTitle
        right={
          <Tap onPress={() => router.push({ pathname: '/task', params: { day } })} hitSlop={10}>
            <Txt variant="label" tone="accent">
              + Ish qoʻshish
            </Txt>
          </Tap>
        }>
        Reja
      </SectionTitle>

      {overdue.length > 0 && (
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
      )}

      {groups.length === 0 ? (
        <Txt variant="caption" tone="faint" style={styles.empty}>
          {tasks.length
            ? 'Qolgan hamma ish asosiylar roʻyxatida.'
            : isCurrent
              ? 'Bugunga ish yoʻq. Kechqurun «Kun yakuni»da ertangi kunni rejalang yoki hozir qoʻshing.'
              : 'Bu kunga ish rejalanmagan edi.'}
        </Txt>
      ) : (
        <Group>
          {groups.map((g, gi) => (
            <View key={g.block ?? 'any'}>
              {gi > 0 && <Divider />}
              <Row style={styles.blockHead}>
                <Txt variant="overline" tone={g.block && g.block === nowBlock ? 'accent' : 'faint'}>
                  {g.block ? BLOCK_LABEL[g.block] : 'Kun davomida'}
                </Txt>
                {g.block && (
                  <Txt variant="caption" tone="faint" numeric>
                    {hhmm(blockStart(times, g.block))}
                  </Txt>
                )}
              </Row>
              {g.items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  meta={taskMeta(t, false)}
                  onToggle={() => setTaskDone(t.id, t.status !== 'done')}
                  onLongPress={() => taskActions(t, day)}
                />
              ))}
            </View>
          ))}
        </Group>
      )}
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

export function HabitsSection({
  day,
  habits,
  marks,
}: {
  day: string;
  habits: Habit[];
  marks: ReadonlyMap<string, boolean>;
}) {
  const wStart = weekStart(day);
  return (
    <>
      <SectionTitle
        right={
          <Tap onPress={() => router.push('/habits')} hitSlop={10}>
            <Txt variant="label" tone={habits.length ? 'faint' : 'accent'}>
              {habits.length ? 'Tahrirlash' : '+ Odat qoʻshish'}
            </Txt>
          </Tap>
        }>
        Odatlar
      </SectionTitle>
      {habits.length === 0 ? (
        <Notice
          title="Hosil qilmoqchi boʻlgan odatlaringiz"
          hint="Zal, kitob, interviewga tayyorlanish… va tiyilmoqchi boʻlganlaringiz: Instagram, kino"
          action="Qoʻshish"
          onPress={() => router.push('/habits')}
        />
      ) : (
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
      )}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: space.xl, lineHeight: 18 },
  blockHead: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 2 },
});
