import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useSetupState } from '../../hooks/useSetup';
import { useUpdateState } from '../../hooks/useUpdate';
import { type BlockId, currentBlock } from '../../lib/blocks';
import { calendarFor } from '../../lib/calendar';
import { setTaskDone } from '../../lib/plan';
import type { TimeKey } from '../../lib/prayer-times';
import { addDays, formatDayLong, formatDuration, hhmm } from '../../lib/time';
import { applyUpdate } from '../../lib/updates';
import { color, font, radius, space } from '../../theme/tokens';
import { Divider, Group, Notice, Row, ScreenScroll, SectionTitle, Spacer, Tap, Txt } from '../../ui';
import {
  AnytimeSection,
  blockTasks,
  HabitsSection,
  openTask,
  OverdueNotice,
  taskActions,
  taskMeta,
  TopTasks,
  useDayPlan,
} from '../../ui/DayPlan';
import { TaskRow } from '../../ui/plan';

/** Necha kun orqaga koʻrish mumkin — tuzatishlar uchun yetarli */
const MAX_BACK_DAYS = 30;
/** Oldinga — kelgusi kunlarni rejalash uchun */
const MAX_AHEAD_DAYS = 14;

/**
 * Kun tartibi tayanchlari. Har bir namoz vaqti — oʻzidan keyingi kun boʻlagining
 * boshi; ishlar oʻz boʻlagi ostida turadi. Namoz oʻqilganini belgilash — Namozimda.
 */
const ANCHORS: { key: TimeKey; name: string; block: BlockId; until: string }[] = [
  { key: 'bomdod', name: 'Bomdod', block: 'morning', until: 'Peshin' },
  { key: 'peshin', name: 'Peshin', block: 'noon', until: 'Asr' },
  { key: 'asr', name: 'Asr', block: 'afternoon', until: 'Shom' },
  { key: 'shom', name: 'Shom', block: 'evening', until: 'Xufton' },
  { key: 'xufton', name: 'Xufton', block: 'night', until: 'Bomdod' },
];

export default function TodayScreen() {
  const now = useNow(15_000);
  const settings = useSettings();
  const setup = useSetupState();
  const update = useUpdateState();

  const cal = calendarFor(settings);
  const currentDay = cal.prayerDayAt(now);
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? currentDay;
  const isCurrent = day === currentDay;
  const times = cal.times(day);
  const nightEnd = cal.windows(day).xufton.end; // ertangi Bomdod
  const nowBlock = isCurrent ? currentBlock(times, now) : null;
  const plan = useDayPlan(day);

  const minDay = addDays(currentDay, -MAX_BACK_DAYS);
  const maxDay = addDays(currentDay, MAX_AHEAD_DAYS);
  const go = (d: string) => setPicked(d === currentDay ? null : d);
  const done = plan.tasks.filter((t) => t.status === 'done').length;

  /** Boʻlak qachon tugaydi — keyingi namoz vaqti */
  const endOf = (i: number) => (i + 1 < ANCHORS.length ? times[ANCHORS[i + 1].key] : nightEnd);

  return (
    <View style={styles.root}>
    <ScreenScroll>
      {/* ── Sana ── */}
      <Row style={styles.dateRow}>
        <Tap onPress={() => go(addDays(day, -1))} disabled={day <= minDay} hitSlop={12}>
          <Txt variant="title" tone="muted" style={styles.arrow}>
            ‹
          </Txt>
        </Tap>
        <Tap onPress={() => setPicked(null)} haptic={!isCurrent} style={{ flex: 1 }}>
          <View style={{ alignItems: 'center' }}>
            <Txt variant="overline" tone={isCurrent ? 'faint' : 'accent'}>
              {isCurrent ? 'Bugun' : day === addDays(currentDay, 1) ? 'Ertaga · bugunga qaytish' : 'Bugunga qaytish'}
            </Txt>
            <Txt variant="bodyMedium" style={{ marginTop: 2 }}>
              {formatDayLong(day)}
            </Txt>
          </View>
        </Tap>
        <Tap onPress={() => go(addDays(day, 1))} disabled={day >= maxDay} hitSlop={12}>
          <Txt variant="title" tone="muted" style={styles.arrow}>
            ›
          </Txt>
        </Tap>
      </Row>

      {/* ── Kunning asosiy ishlari — kechqurun rejalangan maqsad ── */}
      <TopTasks day={day} tasks={plan.tasks} title={isCurrent ? 'Bugungi asosiy' : 'Asosiy ishlar'} />

      {/* ── Diqqat ── */}
      {update.ready && (
        <>
          <Notice title="Yangi versiya tayyor" hint="Qoʻllash uchun bosing — ilova qayta ochiladi" action="Qoʻllash" onPress={applyUpdate} />
          <Spacer size={space.md} />
        </>
      )}
      {!setup.loading && setup.missing > 0 && (
        <>
          <Notice
            title="Eslatmalar kelmasligi mumkin"
            hint={`Huawei uchun ${setup.missing} ta sozlama qoldi — 1 daqiqalik ish`}
            action="Sozlash"
            onPress={() => router.push('/setup')}
          />
          <Spacer size={space.md} />
        </>
      )}

      {isCurrent && <OverdueNotice day={day} />}

      {/* ── Kun tartibi: namoz vaqtlari va ularning ostida oʻsha boʻlak ishlari ── */}
      <SectionTitle>Kun tartibi</SectionTitle>
      <Group>
        {ANCHORS.map((a, i) => {
          const active = nowBlock === a.block;
          const items = blockTasks(plan.tasks, a.block);
          return (
            <View key={a.key}>
              {i > 0 && <Divider inset={space.lg} />}
              <Tap onPress={() => router.push({ pathname: '/task', params: { day, block: a.block } })} scaleTo={0.985}>
                <Row style={styles.anchorRow}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyMedium" tone={active ? 'accent' : 'default'}>
                      {a.name}
                    </Txt>
                    {active && (
                      <Txt variant="caption" tone="faint" numeric style={{ marginTop: 2 }}>
                        Hozir · {a.until}gacha {formatDuration(endOf(i).getTime() - now.getTime())}
                      </Txt>
                    )}
                  </View>
                  <Txt variant="label" tone={active ? 'accent' : 'muted'} numeric>
                    {hhmm(times[a.key])}
                  </Txt>
                  <Txt variant="label" tone="faint" style={styles.plus}>
                    +
                  </Txt>
                </Row>
              </Tap>
              {a.key === 'bomdod' && (
                <Row style={styles.sunRow}>
                  <Txt variant="caption" tone="faint">
                    Quyosh chiqishi
                  </Txt>
                  <Txt variant="caption" tone="faint" numeric style={styles.sunTime}>
                    {hhmm(times.quyosh)}
                  </Txt>
                </Row>
              )}
              {items.map((t) => (
                <TaskRow
                  key={t.id}
                  nested
                  task={t}
                  meta={taskMeta(t)}
                  onToggle={() => setTaskDone(t.id, t.status !== 'done')}
                  onPress={() => openTask(t)}
                  onLongPress={() => taskActions(t, day)}
                />
              ))}
            </View>
          );
        })}
      </Group>

      {plan.tasks.length > 0 && (
        <Txt variant="caption" tone="muted" numeric style={styles.summary}>
          Bajarildi {done}/{plan.tasks.length}
        </Txt>
      )}

      {/* ── Boʻlaksiz ishlar va (qoʻshilgan boʻlsa) odatlar ── */}
      <AnytimeSection day={day} tasks={plan.tasks} tense={isCurrent ? 'today' : day > currentDay ? 'future' : 'past'} />
      <HabitsSection day={day} habits={plan.habits} marks={plan.marks} />

      <Txt variant="caption" tone="faint" style={styles.footer}>
        Kun boʻlaklari Toʻraqoʻrgʻon namoz vaqtlari bilan birga siljiydi.{'\n'}
        Doirachani bosing — bajarildi. Ish nomini bosing — tahrirlash; uzoq bosing — ertaga oʻtkazish yoki voz kechish.
        Namoz vaqtini bosing — oʻsha boʻlakka ish qoʻshiladi.
      </Txt>
    </ScreenScroll>

      {/* Qoʻshish — bosh barmoq yetadigan joyda, skroll qayerda boʻlmasin koʻrinib turadi */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Tap
          onPress={() => router.push({ pathname: '/task', params: { day } })}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel="Ish qoʻshish">
          <View style={styles.fab}>
            <Txt style={styles.fabPlus}>+</Txt>
            <Txt variant="label" style={{ color: color.bg }}>
              Ish qoʻshish
            </Txt>
          </View>
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  fabWrap: { position: 'absolute', right: space.lg, bottom: space.lg },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 52,
    paddingLeft: space.lg,
    paddingRight: space.xl,
    borderRadius: radius.full,
    backgroundColor: color.accent,
  },
  fabPlus: { fontFamily: font.medium, fontSize: 24, lineHeight: 28, color: color.bg },
  dateRow: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  arrow: { paddingHorizontal: space.md, fontSize: 28, lineHeight: 32 },
  anchorRow: { paddingHorizontal: space.lg, paddingVertical: space.md + 2, minHeight: 56 },
  plus: { width: 28, textAlign: 'right' },
  sunRow: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  sunTime: { marginRight: 28 },
  summary: { paddingHorizontal: space.xl, paddingTop: space.md },
  footer: { paddingHorizontal: space.xl, paddingTop: space.xl, lineHeight: 18 },
});
