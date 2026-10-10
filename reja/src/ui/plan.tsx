/**
 * Reja elementlari — vazifa va odat qatorlari, belgilash doirachasi, tanlov chipi.
 * Bugun, Tahlil va modal ekranlarda bir xil koʻrinadi.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Habit } from '../lib/habits';
import type { Task } from '../lib/plan';
import { color, radius, space } from '../theme/tokens';
import { Row, Tap, Txt } from './index';

/** Doiracha: boʻsh / ✓ / ✕ */
export function Check({ state, size = 22 }: { state: boolean | undefined; size?: number }) {
  const done = state === true;
  const failed = state === false;
  return (
    <View
      style={[
        styles.check,
        { width: size, height: size, borderRadius: size / 2 },
        done && { backgroundColor: color.text, borderColor: color.text },
        failed && { borderColor: color.dangerMuted, backgroundColor: color.dangerFaint },
      ]}>
      {done && (
        <Txt variant="caption" style={{ color: color.bg, fontSize: size * 0.55, lineHeight: size * 0.75 }}>
          ✓
        </Txt>
      )}
      {failed && (
        <Txt variant="caption" tone="danger" style={{ fontSize: size * 0.5, lineHeight: size * 0.75 }}>
          ✕
        </Txt>
      )}
    </View>
  );
}

/**
 * Ish qatori. Ikki xil bosish — tasodifan "bajarildi" boʻlib qolmasin:
 *   doiracha — bajarildi / qaytarish
 *   nomi     — tahrirlash (uzoq bosish — tezkor amallar)
 */
export function TaskRow({
  task,
  onToggle,
  onPress,
  onLongPress,
  meta,
  right,
  nested,
}: {
  task: Task;
  onToggle: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Sarlavha ostidagi izoh: boʻlak nomi, "2 marta koʻchirildi" */
  meta?: string;
  /** Oʻng tomondagi qoʻshimcha tugmalar (Tahlil ekranida) */
  right?: ReactNode;
  /** Kun tartibida namoz vaqti ostida — ichkariroq */
  nested?: boolean;
}) {
  const done = task.status === 'done';
  return (
    <Row style={[styles.row, nested && styles.nested]}>
      <Tap
        onPress={onToggle}
        hitSlop={12}
        scaleTo={0.85}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? 'Bajarilmagan deb qaytarish' : 'Bajarildi'}>
        <Check state={done ? true : undefined} />
      </Tap>
      <Tap onPress={onPress} onLongPress={onLongPress} delayLongPress={350} scaleTo={0.985} haptic={!!onPress} style={styles.body}>
        <Row style={{ justifyContent: 'flex-start', gap: space.sm }}>
          {task.priority === 1 && !done && (
            <Txt variant="label" tone="accent">
              ★
            </Txt>
          )}
          <Txt
            variant="body"
            tone={done ? 'faint' : 'default'}
            style={[{ flexShrink: 1 }, done && { textDecorationLine: 'line-through' }]}
            numberOfLines={3}>
            {task.title}
          </Txt>
        </Row>
        {meta ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {meta}
          </Txt>
        ) : null}
      </Tap>
      {right}
    </Row>
  );
}

export function HabitRow({
  habit,
  state,
  meta,
  onPress,
  onLongPress,
  right,
}: {
  habit: Habit;
  state: boolean | undefined;
  meta: string;
  onPress: () => void;
  onLongPress?: () => void;
  right?: ReactNode;
}) {
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} scaleTo={0.985} delayLongPress={350}>
      <Row style={styles.row}>
        <Check state={state} />
        <View style={{ flex: 1 }}>
          <Txt variant="body" tone={state === true ? 'muted' : 'default'} numberOfLines={2}>
            {habit.title}
          </Txt>
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {habit.kind === 'avoid' ? 'tiyilish · ' : ''}
            {meta}
          </Txt>
        </View>
        {right}
      </Row>
    </Tap>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Tap onPress={onPress} scaleTo={0.95}>
      <View style={[styles.chip, selected && { backgroundColor: color.text, borderColor: color.text }]}>
        <Txt variant="label" style={{ color: selected ? color.bg : color.textMuted }}>
          {label}
        </Txt>
      </View>
    </Tap>
  );
}

/** Kichik matnli tugma — qator ichidagi amallar uchun ("Ertaga", "Ha", "Yoʻq") */
export function MiniAction({ label, onPress, tone = 'muted' }: { label: string; onPress: () => void; tone?: 'muted' | 'accent' | 'danger' | 'default' }) {
  return (
    <Tap onPress={onPress} hitSlop={6} scaleTo={0.92}>
      <View style={styles.mini}>
        <Txt variant="label" tone={tone}>
          {label}
        </Txt>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 52, gap: space.md, justifyContent: 'flex-start' },
  nested: { paddingLeft: space.xxl, paddingVertical: space.sm + 2, minHeight: 44 },
  body: { flex: 1, justifyContent: 'center', minHeight: 32 },
  check: {
    borderWidth: 1.5,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.borderStrong,
    justifyContent: 'center',
  },
  mini: {
    paddingHorizontal: space.sm + 2,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceHigh,
    justifyContent: 'center',
  },
});
