import * as Haptics from 'expo-haptics';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, hairline, space, type } from '../../theme/tokens';
import { Txt } from '../../ui';

/**
 * Tab bar — ikonsiz, faqat matn va tanlangan tab ostida nuqta (MoliyamApp uslubi).
 * expo-router/ui headless API. `asChild` bolalariga massiv stil berib boʻlmaydi —
 * Slot uni rad etadi, shuning uchun stil oldindan tekislanadi.
 */

type TabButtonProps = TabTriggerSlotProps & { label: string };

function TabButton({ label, isFocused, onPress, ...rest }: TabButtonProps) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        if (!isFocused) Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={styles.tab}
      hitSlop={8}>
      <View style={styles.tabInner}>
        <Txt style={[type.label, { color: isFocused ? color.text : color.textFaint }]}>{label}</Txt>
        <View style={[styles.dot, isFocused && { backgroundColor: color.text }]} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const barStyle = StyleSheet.flatten([styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]);

  return (
    <Tabs style={styles.root}>
      <TabSlot />
      <TabList asChild>
        <View style={barStyle}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton label="Bugun" />
          </TabTrigger>
          <TabTrigger name="qazo" href="/qazo" asChild>
            <TabButton label="Qazo" />
          </TabTrigger>
          <TabTrigger name="review" href="/review" asChild>
            <TabButton label="Tahlil" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton label="Sozlama" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  bar: {
    flexDirection: 'row',
    backgroundColor: color.bg,
    borderTopWidth: hairline,
    borderTopColor: color.border,
    paddingTop: space.md,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabInner: { alignItems: 'center', gap: space.sm },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
});
