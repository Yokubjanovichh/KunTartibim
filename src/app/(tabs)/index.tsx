import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDataVersion, useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useSetupState } from '../../hooks/useSetup';
import { useUpdateState } from '../../hooks/useUpdate';
import type { PrayerWindow } from '../../lib/prayer-times';
import { PRAYER_NAME, PRAYERS, type PrayerId } from '../../lib/prayers';
import { dayStatuses, nowInfo, type PrayerStatus } from '../../lib/status';
import { addDays, formatDayLong, formatDuration, formatDurationShort, hhmm } from '../../lib/time';
import { setTaskDone } from '../../lib/plan';
import { calendarFor, getRecords, markPrayer, reconcile } from '../../lib/tracker';
import { applyUpdate } from '../../lib/updates';
import { color, space } from '../../theme/tokens';
import { Badge, Button, Divider, Group, Notice, Progress, Row, ScreenScroll, SectionTitle, Spacer, Tap, Txt } from '../../ui';
import {
  AnytimeSection,
  BLOCK_AFTER,
  blockTasks,
  HabitsSection,
  OverdueNotice,
  taskActions,
  taskMeta,
  TopTasks,
  useDayPlan,
} from '../../ui/DayPlan';
import { TaskRow } from '../../ui/plan';
import { pressPrayer } from '../../ui/prayerActions';

/** Necha kun orqaga koʻrish mumkin — tuzatishlar uchun yetarli */
const MAX_BACK_DAYS = 30;

export default function TodayScreen() {
  const now = useNow(15_000);
  const version = useDataVersion();
  const settings = useSettings();
  const setup = useSetupState();
  const update = useUpdateState();

  const cal = calendarFor(settings);
  const currentDay = cal.prayerDayAt(now);
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked && picked < currentDay ? picked : currentDay;
  const isCurrent = day === currentDay;
  const trackingStart = useMemo(() => new Date(settings.trackingStart), [settings.trackingStart]);

  // Vaqt oʻtgan sari vaqti chiqqan namozlar qazoga oʻtadi
  useEffect(() => {
    reconcile(now);
  }, [now]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(() => getRecords(day, day), [day, version]);
  const statuses = dayStatuses(cal, day, records, now, trackingStart);
  const wins = cal.windows(day);
  const times = cal.times(day);
  const info = nowInfo(cal, now);

  const prayedCount = PRAYERS.filter((p) => statuses[p] === 'prayed').length;
  const qazoCount = PRAYERS.filter((p) => statuses[p] === 'qazo' || statuses[p] === 'missed').length;

  const onRowPress = (p: PrayerId) => pressPrayer(day, p, statuses[p], wins[p], now);
  const plan = useDayPlan(day);

  const minDay = addDays(currentDay, -MAX_BACK_DAYS);

  return (
    <ScreenScroll>
      {/* ── Sana ── */}
      <Row style={styles.dateRow}>
        <Tap onPress={() => setPicked(addDays(day, -1))} disabled={day <= minDay} hitSlop={12}>
          <Txt variant="title" tone="muted" style={styles.arrow}>
            ‹
          </Txt>
        </Tap>
        <Tap onPress={() => setPicked(null)} haptic={!isCurrent} style={{ flex: 1 }}>
          <View style={{ alignItems: 'center' }}>
            <Txt variant="overline" tone={isCurrent ? 'faint' : 'accent'}>
              {isCurrent ? 'Bugun' : 'Bugunga qaytish'}
            </Txt>
            <Txt variant="bodyMedium" style={{ marginTop: 2 }}>
              {formatDayLong(day)}
            </Txt>
          </View>
        </Tap>
        <Tap onPress={() => setPicked(addDays(day, 1))} disabled={isCurrent} hitSlop={12}>
          <Txt variant="title" tone="muted" style={styles.arrow}>
            ›
          </Txt>
        </Tap>
      </Row>

      {/* ── Hozir ── */}
      {isCurrent && <Hero now={now} info={info} statuses={statuses} warnMinutes={settings.warnMinutes} />}

      {/* ── Kunning asosiy ishlari — kechqurun rejalangan maqsad ── */}
      <TopTasks day={day} tasks={plan.tasks} />

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

      {/* ── Kun tartibi: namozlar va ularning ostida oʻsha blok ishlari ── */}
      <SectionTitle
        right={
          <Tap onPress={() => router.push({ pathname: '/task', params: { day } })} hitSlop={10}>
            <Txt variant="label" tone="accent">
              + Ish qoʻshish
            </Txt>
          </Tap>
        }>
        Kun tartibi
      </SectionTitle>
      <Group>
        {PRAYERS.map((p, i) => {
          const block = BLOCK_AFTER[p];
          const items = block ? blockTasks(plan.tasks, block) : [];
          return (
            <View key={p}>
              {i > 0 && <Divider inset={space.lg} />}
              <PrayerRow
                prayer={p}
                win={wins[p]}
                status={statuses[p]}
                isNext={isCurrent && info.next.prayer === p && info.next.day === day}
                now={now}
                onPress={() => onRowPress(p)}
              />
              {p === 'bomdod' && (
                <Row style={styles.sunRow}>
                  <Txt variant="caption" tone="faint">
                    Quyosh chiqishi
                  </Txt>
                  <Txt variant="caption" tone="faint" numeric>
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
                  onLongPress={() => taskActions(t, day)}
                />
              ))}
            </View>
          );
        })}
      </Group>

      <Row style={styles.summary}>
        <Txt variant="caption" tone="muted" numeric>
          {prayedCount}/6 oʻqildi
        </Txt>
        {qazoCount > 0 && (
          <Txt variant="caption" tone="danger" numeric>
            {qazoCount} ta qazo
          </Txt>
        )}
        {plan.tasks.length > 0 && (
          <Txt variant="caption" tone="muted" numeric>
            ishlar {plan.tasks.filter((t) => t.status === 'done').length}/{plan.tasks.length}
          </Txt>
        )}
      </Row>

      {/* ── Bloksiz ishlar va (qoʻshilgan boʻlsa) odatlar ── */}
      <AnytimeSection day={day} tasks={plan.tasks} isCurrent={isCurrent} />
      <HabitsSection day={day} habits={plan.habits} marks={plan.marks} />

      <Txt variant="caption" tone="faint" style={styles.footer}>
        Toʻraqoʻrgʻon · islom.uz usuli (15,5°, Hanafiy){'\n'}
        Bosing — belgilanadi. Uzoq bosing — tahrirlash, ertaga oʻtkazish, voz kechish.
      </Txt>
    </ScreenScroll>
  );
}

/* ── Hozirgi namoz ────────────────────────────────────────────────────────── */

function Hero({
  now,
  info,
  statuses,
  warnMinutes,
}: {
  now: Date;
  info: ReturnType<typeof nowInfo>;
  statuses: Record<PrayerId, PrayerStatus>;
  warnMinutes: number;
}) {
  const cur = info.current;
  const next = info.next;
  const untilNext = next.start.getTime() - now.getTime();

  if (!cur) {
    return (
      <View style={styles.hero}>
        <Txt variant="overline" tone="faint">
          Keyingi namoz
        </Txt>
        <Row style={{ justifyContent: 'flex-start', alignItems: 'baseline', gap: space.md, marginTop: space.sm }}>
          <Txt variant="display">{PRAYER_NAME[next.prayer]}</Txt>
          <Txt variant="numberMd" tone="muted" numeric>
            {hhmm(next.start)}
          </Txt>
        </Row>
        <Txt variant="body" tone="muted" style={{ marginTop: space.xs }}>
          {formatDuration(untilNext)}dan keyin
        </Txt>
      </View>
    );
  }

  const status = statuses[cur.prayer];
  const done = status === 'prayed';
  const total = cur.end.getTime() - cur.start.getTime();
  const left = cur.end.getTime() - now.getTime();
  const endingSoon = left <= warnMinutes * 60_000;
  const vitrPending = cur.prayer === 'xufton' && statuses.vitr !== 'prayed';

  return (
    <View style={styles.hero}>
      <Txt variant="overline" tone={done ? 'faint' : 'accent'}>
        {done ? 'Oʻqildi' : 'Hozir vaqti'}
      </Txt>
      <Row style={{ justifyContent: 'flex-start', alignItems: 'baseline', gap: space.md, marginTop: space.sm }}>
        <Txt variant="display" tone={done ? 'muted' : 'default'}>
          {PRAYER_NAME[cur.prayer]}
        </Txt>
        <Txt variant="numberMd" tone="faint" numeric>
          {hhmm(cur.start)} – {hhmm(cur.end)}
        </Txt>
      </Row>

      {!done && (
        <>
          <Txt variant="body" tone={endingSoon ? 'danger' : 'muted'} style={{ marginTop: space.xs }}>
            Vaqti tugashiga {formatDuration(left)}
          </Txt>
          <Spacer size={space.md} />
          <Progress value={1 - left / total} tone={endingSoon ? 'danger' : 'accent'} />
          <Spacer size={space.lg} />
          <Button title={`${PRAYER_NAME[cur.prayer]}ni oʻqidim`} kind="accent" onPress={() => markPrayer(cur.day, cur.prayer, 'prayed', 'app')} />
        </>
      )}

      {done && vitrPending && (
        <>
          <Spacer size={space.lg} />
          <Button title="Vitrni ham oʻqidim" kind="secondary" onPress={() => markPrayer(cur.day, 'vitr', 'prayed', 'app')} />
        </>
      )}

      <Txt variant="caption" tone="faint" style={{ marginTop: space.md }} numeric>
        Keyingisi: {PRAYER_NAME[next.prayer]} · {hhmm(next.start)} ({formatDurationShort(untilNext)} qoldi)
      </Txt>
    </View>
  );
}

/* ── Namoz qatori ─────────────────────────────────────────────────────────── */

function PrayerRow({
  prayer,
  win,
  status,
  isNext,
  now,
  onPress,
}: {
  prayer: PrayerId;
  win: PrayerWindow;
  status: PrayerStatus;
  isNext: boolean;
  now: Date;
  onPress: () => void;
}) {
  const range =
    prayer === 'vitr' ? `Xuftondan keyin · ${hhmm(win.end)} gacha` : `${hhmm(win.start)} – ${hhmm(win.end)}`;
  const nameTone = status === 'active' ? 'accent' : status === 'upcoming' ? 'muted' : 'default';

  return (
    <Tap onPress={onPress} disabled={status === 'upcoming'} scaleTo={0.985} haptic={status !== 'upcoming'}>
      <Row style={styles.prayerRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyMedium" tone={nameTone}>
            {PRAYER_NAME[prayer]}
          </Txt>
          <Txt variant="caption" tone="faint" numeric style={{ marginTop: 2 }}>
            {range}
          </Txt>
        </View>
        <StatusMark status={status} isNext={isNext} untilStart={win.start.getTime() - now.getTime()} />
      </Row>
    </Tap>
  );
}

function StatusMark({ status, isNext, untilStart }: { status: PrayerStatus; isNext: boolean; untilStart: number }) {
  switch (status) {
    case 'prayed':
      return (
        <Txt variant="label" tone="muted">
          Oʻqildi ✓
        </Txt>
      );
    case 'active':
      return (
        <View style={styles.markBtn}>
          <Txt variant="label" style={{ color: color.bg }}>
            Oʻqidim
          </Txt>
        </View>
      );
    case 'qazo':
    case 'missed':
      return <Badge tone="danger">Qazo</Badge>;
    case 'untracked':
      return (
        <Txt variant="label" tone="faint">
          —
        </Txt>
      );
    case 'upcoming':
      return isNext ? (
        <Txt variant="caption" tone="faint" numeric>
          {formatDurationShort(untilStart)} qoldi
        </Txt>
      ) : null;
  }
}

const styles = StyleSheet.create({
  dateRow: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  arrow: { paddingHorizontal: space.md, fontSize: 28, lineHeight: 32 },
  hero: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  prayerRow: { paddingHorizontal: space.lg, paddingVertical: space.md + 2, minHeight: 60 },
  sunRow: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  markBtn: {
    backgroundColor: color.accent,
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
  },
  summary: { paddingHorizontal: space.xl, paddingTop: space.md, justifyContent: 'flex-start', gap: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: space.xl, lineHeight: 18 },
});
