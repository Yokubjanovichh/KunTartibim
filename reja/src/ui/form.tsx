/**
 * Forma ekranlari — MoliyamApp'dagi qoʻshish ekrani tartibida:
 *   · tepada sarlavha va ✕
 *   · oʻrtada skroll (klaviatura ochiq turganda ham chiplarni bosish mumkin)
 *   · pastda QOTIRILGAN katta tugma — klaviatura ochilsa uning ustida turadi,
 *     roʻyxat oxirini qidirib skroll qilish shart emas
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisible } from '../hooks/useKeyboard';
import { color, font, hairline, radius, space } from '../theme/tokens';
import { Row, Tap, Txt } from './index';

export function FormScreen({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Pastda qotirilgan tugma(lar) */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Row style={styles.header}>
        <Txt variant="overline" tone="faint">
          {title}
        </Txt>
        <Tap onPress={onClose} hitSlop={12}>
          <Txt variant="title" tone="muted">
            ✕
          </Txt>
        </Tap>
      </Row>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: keyboard ? space.md : Math.max(insets.bottom, space.md) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Ish yoki odat nomi: uzun boʻlsa keyingi qatorga oʻtadi (bitta qatorda yashirinmaydi).
 * Enter yangi qator qoʻymaydi — `onSubmitEditing` ni chaqiradi (saqlash / qoʻshish).
 */
export function TitleInput({ style, ...rest }: TextInputProps) {
  return (
    <View style={styles.inputBox}>
      <TextInput
        multiline
        submitBehavior="submit"
        returnKeyType="done"
        textAlignVertical="top"
        placeholderTextColor={color.textFaint}
        cursorColor={color.accent}
        selectionColor={color.accentMuted}
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md },
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: hairline,
    borderTopColor: color.border,
    backgroundColor: color.bg,
  },
  inputBox: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  input: {
    fontFamily: font.medium,
    fontSize: 18,
    lineHeight: 24,
    color: color.text,
    paddingHorizontal: space.lg,
    paddingTop: space.md + 2,
    paddingBottom: space.md + 2,
    minHeight: 56,
    maxHeight: 176,
  },
});
