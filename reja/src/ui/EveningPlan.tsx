/**
 * Kun yakuni va ertangi reja — Tahlil ekranining asosi.
 *
 * Foydalanuvchi: "kunni yakunlaganda ertangi kunga reja tuzish ko'proq harakatga va
 * ertalab maqsad bilan turishga undaydi, lekin buni ham odatga aylantirish kerak".
 * Shuning uchun:
 *   TodayClose    — bugungi odatlar (belgilanmaganlar uchun [✓]/[Yoʻq]) va ishlar ([Ertaga])
 *   TomorrowPlan  — ertangi ishlar, ★ asosiylar, "keyinroq" roʻyxati, uyqu hisobi,
 *                   [Reja tayyor ✓] va reja tuzish seriyasi
 *   WeekPlanStats — odatlar, bajarilgan ishlar, reja tuzilgan kunlar
 * Hammasi bitta ekranda — qadam-baqadam sehrgar emas.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useDataVersion } from '../hooks/useData';
import { type Habit, habitMeta, isDaily, markKey, planningStreak, sleepHoursUntil, weekProgress } from '../lib/habits';
import {
  addTask,
  backlogTasks,
  markPlanned,
  moveTasks,
  plannedDays,
  setHabitMark,
  setTaskDone,
  type Task,
  tasksForDay,
  tasksInRange,
  updateTask,
} from '../lib/plan';
import type { PrayerCalendar } from '../lib/prayer-times';
import { addDays, daysBetween, formatDayLong, hhmm, weekStart } from '../lib/time';
import { color, hairline, radius, space, type } from '../theme/tokens';
import { habitLongPress, taskActions, taskMeta } from './DayPlan';
import { Button, Divider, Group, Progress, Row, SectionTitle, Spacer, Txt } from './index';
import { HabitRow, MiniAction, TaskRow } from './plan';

const editTask = (t: Task) => router.push({ pathname: '/task', params: { id: String(t.id) } });

/* ── Bugunni yopish ───────────────────────────────────────────────────────── */

export function TodayClose({
  today,
  habits,
  marks,
  tasks,
}: {
  today: string;
  habits: Habit[];
  marks: ReadonlyMap<string, boolean>;
  tasks: Task[];
}) {
  const wStart = weekStart(today);
  const tomorrow = addDays(today, 1);
  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <>
      {/* Ishlar birinchi — foydalanuvchi uchun hozir kunlik reja odatlardan muhimroq */}
      {tasks.length > 0 && (
        <>
          <SectionTitle right={<Txt variant="caption" tone="faint" numeric>{done.length}/{tasks.length}</Txt>}>
            Bugungi ishlar
          </SectionTitle>
          <Group>
            {[...open, ...done].map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Divider inset={space.xxxl} />}
                <TaskRow
                  task={t}
                  meta={taskMeta(t, { block: true })}
                  onToggle={() => setTaskDone(t.id, t.status !== 'done')}
                  onLongPress={() => taskActions(t, today)}
                  right={t.status === 'open' ? <MiniAction label="Ertaga" onPress={() => moveTasks([t.id], tomorrow)} /> : undefined}
                />
              </View>
            ))}
          </Group>
          {open.length > 1 && (
            <View style={[styles.pad, { marginTop: space.md }]}>
              <Button title={`Qolgan ${open.length} tasini ertaga oʻtkazish`} kind="secondary" onPress={() => moveTasks(open.map((t) => t.id), tomorrow)} />
            </View>
          )}
        </>
      )}

      {habits.length > 0 && (
        <>
          <SectionTitle>Bugungi odatlar</SectionTitle>
          <Group>
            {habits.map((h, i) => {
              const state = marks.get(markKey(h.id, today));
              const unanswered = state === undefined;
              return (
                <View key={h.id}>
                  {i > 0 && <Divider inset={space.xxxl} />}
                  <HabitRow
                    habit={h}
                    state={state}
                    meta={
                      unanswered
                        ? h.kind === 'avoid'
                          ? 'Bugun tiyildingizmi?'
                          : 'Bugun bajardingizmi?'
                        : habitMeta(h, marks, wStart, today)
                    }
                    onPress={() => setHabitMark(h.id, today, state === true ? null : true)}
                    onLongPress={() => habitLongPress(h, today, state)}
                    right={
                      unanswered ? (
                        <Row style={{ gap: space.xs }}>
                          <MiniAction label={h.kind === 'avoid' ? 'Ha' : '✓'} tone="default" onPress={() => setHabitMark(h.id, today, true)} />
                          <MiniAction label="Yoʻq" onPress={() => setHabitMark(h.id, today, false)} />
                        </Row>
                      ) : undefined
                    }
                  />
                </View>
              );
            })}
          </Group>
        </>
      )}
    </>
  );
}

/* ── Ertangi reja ─────────────────────────────────────────────────────────── */

export function TomorrowPlan({
  today,
  now,
  cal,
  habits,
  marks,
}: {
  today: string;
  now: Date;
  cal: PrayerCalendar;
  habits: Habit[];
  marks: ReadonlyMap<string, boolean>;
}) {
  const version = useDataVersion();
  const tomorrow = addDays(today, 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const tasks = useMemo(() => tasksForDay(tomorrow), [tomorrow, version]);
  const backlog = useMemo(() => backlogTasks(), [version]);
  const planned = useMemo(() => plannedDays(addDays(today, -400), tomorrow), [today, tomorrow, version]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const [draft, setDraft] = useState('');

  const isPlanned = planned.has(tomorrow);
  const streak = planningStreak(planned, today);
  const night = cal.windows(today).xufton;
  const wake = night.end; // ertangi Bomdod
  const evening = now.getTime() >= night.start.getTime();
  const hours = String(sleepHoursUntil(now, wake)).replace('.', ',');
  const wStart = weekStart(tomorrow);

  const add = () => {
    if (!draft.trim()) return;
    addTask({ title: draft, day: tomorrow });
    setDraft('');
  };

  const finish = () => {
    markPlanned(tomorrow);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const habitLine = habits
    .map((h) => (isDaily(h) ? h.title : `${h.title} (${weekProgress(h.id, marks, wStart, tomorrow).done}/${h.targetPerWeek})`))
    .join(' · ');

  return (
    <>
      <SectionTitle right={<Txt variant="caption" tone="faint">{formatDayLong(tomorrow)}</Txt>}>Ertangi reja</SectionTitle>
      <Txt variant="body" tone="muted" style={styles.pad} numeric>
        Bomdod {hhmm(wake)}
        {evening ? ` · hozir yotsangiz ${hours} soat uxlaysiz` : ''}
      </Txt>

      <View style={styles.addBox}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ertaga nima qilasiz? Yozib, «Qoʻshish»"
          placeholderTextColor={color.textFaint}
          onSubmitEditing={add}
          submitBehavior="submit"
          returnKeyType="done"
          style={styles.addInput}
          cursorColor={color.accent}
          selectionColor={color.accentMuted}
        />
        {draft.trim() ? <MiniAction label="Qoʻshish" tone="accent" onPress={add} /> : null}
      </View>

      {tasks.length > 0 && (
        <>
          <Txt variant="caption" tone="faint" style={styles.sub}>
            ★ — asosiy ish (3 tagacha): ertalabki «Bugungi reja» eslatmasida koʻrinadi
          </Txt>
          <Group>
            {tasks.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Divider inset={space.xxxl} />}
                <TaskRow
                  task={t}
                  meta={taskMeta(t, { block: true }) ?? 'Bosing — vaqt yoki kun boʻlagini belgilang'}
                  onToggle={() => editTask(t)}
                  onLongPress={() => taskActions(t, tomorrow)}
                  right={
                    <MiniAction
                      label={t.priority === 1 ? '★' : '☆'}
                      tone={t.priority === 1 ? 'accent' : 'muted'}
                      onPress={() => updateTask(t.id, { priority: t.priority !== 1 })}
                    />
                  }
                />
              </View>
            ))}
          </Group>
        </>
      )}

      {backlog.length > 0 && (
        <>
          <Txt variant="caption" tone="faint" style={styles.sub}>
            «Keyinroq» roʻyxatidan olish:
          </Txt>
          <Group>
            {backlog.slice(0, 8).map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Divider inset={space.xxxl} />}
                <TaskRow
                  task={t}
                  onToggle={() => editTask(t)}
                  onLongPress={() => taskActions(t, tomorrow)}
                  right={<MiniAction label="Ertaga" tone="default" onPress={() => moveTasks([t.id], tomorrow)} />}
                />
              </View>
            ))}
          </Group>
        </>
      )}

      {habits.length > 0 && (
        <Txt variant="caption" tone="faint" style={styles.sub}>
          Ertangi odatlar: {habitLine}
        </Txt>
      )}

      <View style={[styles.pad, { marginTop: space.lg }]}>
        {isPlanned ? (
          <View style={styles.doneBox}>
            <Txt variant="bodyMedium">Reja tayyor ✓</Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
              Oʻzgartirish mumkin — ishlar avtomatik saqlanadi. Yaxshi dam oling.
            </Txt>
          </View>
        ) : (
          <Button title="Reja tayyor ✓" kind="accent" disabled={tasks.length === 0 && habits.length === 0} onPress={finish} />
        )}
        <Txt variant="caption" tone={isPlanned ? 'accent' : 'faint'} style={{ marginTop: space.sm, textAlign: 'center' }} numeric>
          {isPlanned
            ? `Reja tuzish: ${streak} kun ketma-ket`
            : streak > 0
              ? `Seriya: ${streak} kun — bugun ham davom ettiring`
              : 'Har kuni kechqurun reja tuzish ham odat — shu yerdan boshlanadi'}
        </Txt>
      </View>
    </>
  );
}

/* ── Hafta: odatlar va reja ───────────────────────────────────────────────── */

export function WeekPlanStats({
  wStart,
  today,
  habits,
  marks,
}: {
  wStart: string;
  today: string;
  habits: Habit[];
  marks: ReadonlyMap<string, boolean>;
}) {
  const version = useDataVersion();
  /* eslint-disable react-hooks/exhaustive-deps */
  const tasks = useMemo(() => tasksInRange(wStart, today), [wStart, today, version]);
  const planned = useMemo(() => plannedDays(wStart, today), [wStart, today, version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const days = daysBetween(wStart, today) + 1;
  const done = tasks.filter((t) => t.status === 'done').length;
  const stuck = tasks
    .filter((t) => t.status === 'open' && t.movedCount >= 3)
    .sort((a, b) => b.movedCount - a.movedCount)[0];

  return (
    <>
      <SectionTitle>{habits.length ? 'Odatlar va reja' : 'Reja natijasi'}</SectionTitle>
      {habits.length > 0 && (
        <Group style={{ paddingVertical: space.sm }}>
          {habits.map((h) => {
            const w = weekProgress(h.id, marks, wStart, today);
            const target = isDaily(h) ? days : h.targetPerWeek;
            return (
              <View key={h.id} style={styles.barRow}>
                <Row>
                  <Txt variant="label" style={{ flex: 1 }} numberOfLines={1}>
                    {h.title}
                  </Txt>
                  <Txt variant="caption" tone={w.failed ? 'danger' : 'faint'} numeric>
                    {w.done}/{target}
                    {w.failed ? ` · ${w.failed} marta yoʻq` : ''}
                  </Txt>
                </Row>
                <Spacer size={space.sm} />
                <Progress value={target ? w.done / target : 0} />
              </View>
            );
          })}
        </Group>
      )}

      <View style={[styles.pad, { marginTop: space.md, gap: space.xs }]}>
        <Line label="Ishlar bajarildi" value={tasks.length ? `${done}/${tasks.length}` : '—'} />
        <Line label="Reja tuzilgan kunlar" value={`${planned.size}/${days}`} />
        {stuck && (
          <Txt variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            «{stuck.title}» {stuck.movedCount} marta koʻchirildi — kichikroq qadamlarga boʻling yoki voz keching.
          </Txt>
        )}
      </View>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row>
      <Txt variant="body" tone="muted">
        {label}
      </Txt>
      <Txt variant="bodyMedium" numeric>
        {value}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.xl },
  sub: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  addBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingRight: space.sm,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  addInput: { ...type.body, flex: 1, color: color.text, paddingHorizontal: space.lg, paddingVertical: space.md + 2 },
  barRow: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  doneBox: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.accentMuted,
    backgroundColor: color.accentFaint,
  },
});
