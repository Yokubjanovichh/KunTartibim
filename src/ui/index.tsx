/**
 * UI primitivlari — barcha ekranlar shulardan quriladi.
 * Biznes mantiq yoʻq, faqat koʻrinish. Ranglar faqat `theme/tokens` dan.
 */

import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, hairline, motion, radius, space, tabular, type } from '../theme/tokens';

/* ── Matn ─────────────────────────────────────────────────────────────────── */

type Variant = keyof typeof type;
export type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'danger';

const TONE: Record<Tone, string> = {
  default: color.text,
  muted: color.textMuted,
  faint: color.textFaint,
  accent: color.accent,
  danger: color.danger,
};

export interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  numeric?: boolean;
}

export function Txt({ variant = 'body', tone = 'default', numeric, style, ...rest }: TxtProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.25}
      {...rest}
      style={[type[variant], { color: TONE[tone] }, numeric && tabular, style]}
    />
  );
}

/* ── Ekran ────────────────────────────────────────────────────────────────── */

/** Tab bar balandligi + pastki safe area */
const TAB_BAR_CLEARANCE = 104;

export function ScreenScroll({
  children,
  contentContainerStyle,
  withTabBar = true,
  ...rest
}: ScrollViewProps & { withTabBar?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={withTabBar ? ['top'] : ['top', 'bottom']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        {...rest}
        contentContainerStyle={[{ paddingBottom: withTabBar ? TAB_BAR_CLEARANCE : space.xxl }, contentContainerStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Layout ───────────────────────────────────────────────────────────────── */

export function Row({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.row, style]} />;
}

export function Spacer({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={styles.sectionTitle}>
      <Txt variant="overline" tone="faint">
        {children}
      </Txt>
      {right}
    </Row>
  );
}

/** Hairline bilan oʻralgan roʻyxat bloki */
export function Group({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.group, style]} />;
}

/* ── Bosiladigan element — spring + haptic ────────────────────────────────── */

export interface TapProps extends PressableProps {
  children: ReactNode;
  scaleTo?: number;
  haptic?: boolean;
}

export function Tap({ children, scaleTo = 0.97, haptic = true, onPress, style, disabled, ...rest }: TapProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, motion.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.snappy);
      }}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={style}>
      <Animated.View style={[animated, disabled && { opacity: 0.4 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ── Tugma ────────────────────────────────────────────────────────────────── */

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  compact,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'accent';
  disabled?: boolean;
  compact?: boolean;
}) {
  const bg =
    kind === 'primary'
      ? color.text
      : kind === 'accent'
        ? color.accent
        : kind === 'danger'
          ? color.dangerFaint
          : color.surfaceHigh;
  const fg = kind === 'primary' || kind === 'accent' ? color.bg : kind === 'danger' ? color.danger : color.text;
  return (
    <Tap onPress={onPress} disabled={disabled}>
      <View style={[styles.button, compact && styles.buttonCompact, { backgroundColor: bg }]}>
        <Txt variant="label" style={{ color: fg }}>
          {title}
        </Txt>
      </View>
    </Tap>
  );
}

/* ── Sozlama qatori ───────────────────────────────────────────────────────── */

export function ListRow({
  title,
  hint,
  right,
  onPress,
  tone = 'default',
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
  tone?: Tone;
}) {
  const body = (
    <Row style={styles.listRow}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Txt variant="body" tone={tone}>
          {title}
        </Txt>
        {hint ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {typeof right === 'string' ? (
        <Txt variant="label" tone="muted" numeric>
          {right}
        </Txt>
      ) : (
        right
      )}
    </Row>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

/** − qiymat + */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <Row style={{ gap: space.xs }}>
      <Tap onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min} hitSlop={6}>
        <View style={styles.stepBtn}>
          <Txt variant="bodyMedium">−</Txt>
        </View>
      </Tap>
      <Txt variant="label" numeric style={{ minWidth: 52, textAlign: 'center' }}>
        {format(value)}
      </Txt>
      <Tap onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max} hitSlop={6}>
        <View style={styles.stepBtn}>
          <Txt variant="bodyMedium">+</Txt>
        </View>
      </Tap>
    </Row>
  );
}

export function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[styles.toggle, value && { backgroundColor: color.text, borderColor: color.text }]}>
      <View style={[styles.knob, value ? { alignSelf: 'flex-end', backgroundColor: color.bg } : null]} />
    </View>
  );
}

/* ── Progress — ingichka chiziq ───────────────────────────────────────────── */

export function Progress({ value, tone = 'default' }: { value: number; tone?: 'default' | 'accent' | 'danger' }) {
  const clamped = Math.max(0, Math.min(1, value));
  const fill = tone === 'accent' ? color.accent : tone === 'danger' ? color.danger : color.text;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'danger' }) {
  const bg = tone === 'accent' ? color.accentFaint : tone === 'danger' ? color.dangerFaint : color.surfaceHigh;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Txt variant="caption" tone={tone === 'default' ? 'muted' : tone} numeric>
        {children}
      </Txt>
    </View>
  );
}

/** Diqqat kartasi — sozlanmagan narsa yoki tayyor yangilanish */
export function Notice({
  title,
  hint,
  action,
  onPress,
  tone = 'accent',
}: {
  title: string;
  hint?: string;
  action?: string;
  onPress?: () => void;
  tone?: 'accent' | 'danger';
}) {
  const border = tone === 'accent' ? color.accentMuted : color.dangerMuted;
  const bg = tone === 'accent' ? color.accentFaint : color.dangerFaint;
  return (
    <Tap onPress={onPress} disabled={!onPress} scaleTo={0.98}>
      <View style={[styles.notice, { borderColor: border, backgroundColor: bg }]}>
        <View style={{ flex: 1, paddingRight: space.md }}>
          <Txt variant="bodyMedium">{title}</Txt>
          {hint ? (
            <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {hint}
            </Txt>
          ) : null}
        </View>
        {action ? (
          <Txt variant="label" tone={tone}>
            {action}
          </Txt>
        ) : null}
      </View>
    </Tap>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Txt variant="body" tone="muted">
        {title}
      </Txt>
      {hint ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: space.xs, textAlign: 'center' }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: hairline, backgroundColor: color.border },
  sectionTitle: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.md },
  group: {
    marginHorizontal: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    overflow: 'hidden',
  },
  listRow: { paddingHorizontal: space.lg, paddingVertical: space.md + 2, minHeight: 52 },
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonCompact: { height: 34, paddingHorizontal: space.md, borderRadius: radius.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceHigh,
    padding: 2,
    justifyContent: 'center',
  },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.textMuted },
  progressTrack: { height: 3, backgroundColor: color.border, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  badge: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
  },
  empty: { paddingVertical: space.xxl, paddingHorizontal: space.xl, alignItems: 'center' },
});
