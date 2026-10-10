import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { useDataVersion } from '../hooks/useData';
import { BLOCK_LABEL, BLOCKS, type BlockId } from '../lib/blocks';
import type { Habit, HabitKind } from '../lib/habits';
import { addHabit, archiveHabit, type HabitInput, listHabits, updateHabit } from '../lib/plan';
import { color, hairline, radius, space, type } from '../theme/tokens';
import { Button, Divider, Group, ListRow, Row, ScreenScroll, SectionTitle, Spacer, Stepper, Tap, Txt } from '../ui';
import { Chip } from '../ui/plan';

/**
 * Odatlar — bitta ekranda qoʻshish, tahrirlash va arxivlash.
 * Takliflar foydalanuvchining oʻzi aytgan maqsadlaridan (2026-10-09): zal, kitob,
 * interview, Instagram va kino. Ular formani toʻldiradi xolos — saqlashdan oldin
 * istalgancha oʻzgartirish mumkin.
 */
const SUGGESTIONS: HabitInput[] = [
  { title: 'Zalga borish', kind: 'do', targetPerWeek: 3, block: null },
  { title: 'Kitob oʻqish', kind: 'do', targetPerWeek: 7, block: null },
  { title: 'Interviewga tayyorlanish', kind: 'do', targetPerWeek: 7, block: null },
  { title: 'Instagram ≤ 30 daqiqa', kind: 'avoid', targetPerWeek: 7, block: null },
  { title: 'Kino koʻrmaslik', kind: 'avoid', targetPerWeek: 7, block: null },
];

const EMPTY: HabitInput = { title: '', kind: 'do', targetPerWeek: 7, block: null };

export default function HabitsScreen() {
  const version = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => listHabits(true), [version]);
  const active = all.filter((h) => !h.archived);
  const archived = all.filter((h) => h.archived);

  const [form, setForm] = useState<HabitInput>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const taken = new Set(all.map((h) => h.title.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !taken.has(s.title.toLowerCase()));

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const save = () => {
    if (!form.title.trim()) return;
    if (editingId) updateHabit(editingId, form);
    else addHabit(form);
    reset();
  };

  const edit = (h: Habit) => {
    setEditingId(h.id);
    setForm({ title: h.title, kind: h.kind, targetPerWeek: h.targetPerWeek, block: h.block });
  };

  const archive = (h: Habit) =>
    Alert.alert(`«${h.title}» arxivlansinmi?`, 'Tarixi va seriyalari tahlilda saqlanib qoladi.', [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'Arxivlash',
        style: 'destructive',
        onPress: () => {
          archiveHabit(h.id);
          if (editingId === h.id) reset();
        },
      },
    ]);

  return (
    <ScreenScroll withTabBar={false}>
      <Row style={styles.top}>
        <Txt variant="overline" tone="faint">
          Odatlar
        </Txt>
        <Tap onPress={() => router.back()} hitSlop={12}>
          <Txt variant="title" tone="muted">
            ✕
          </Txt>
        </Tap>
      </Row>
      <Txt variant="body" tone="muted" style={styles.intro}>
        Kichikdan boshlang: 2–3 ta odat yetarli. Har kuni Bugun ekranida belgilaysiz, kechqurun Kun yakunida koʻrib chiqasiz.
      </Txt>

      {/* ── Forma ── */}
      <SectionTitle>{editingId ? 'Tahrirlash' : 'Yangi odat'}</SectionTitle>
      <View style={styles.form}>
        <TextInput
          value={form.title}
          onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
          placeholder="Masalan: Kitob oʻqish — 20 bet"
          placeholderTextColor={color.textFaint}
          returnKeyType="done"
          onSubmitEditing={save}
          style={styles.input}
          cursorColor={color.accent}
          selectionColor={color.accentMuted}
        />
        <Divider />
        <View style={styles.formBody}>
          <Row style={{ justifyContent: 'flex-start', gap: space.sm }}>
            <Chip label="Qilish" selected={form.kind === 'do'} onPress={() => setForm((f) => ({ ...f, kind: 'do' as HabitKind }))} />
            <Chip label="Tiyilish" selected={form.kind === 'avoid'} onPress={() => setForm((f) => ({ ...f, kind: 'avoid' as HabitKind }))} />
          </Row>
          <Txt variant="caption" tone="faint">
            {form.kind === 'do'
              ? 'Bajarganda belgilaysiz: zal, kitob, tayyorgarlik.'
              : 'Kun oxirida «tiyildingizmi?» deb soʻraladi: Instagram, kino, kech yotish.'}
          </Txt>

          <Row>
            <Txt variant="body">Haftada</Txt>
            <Stepper
              value={form.targetPerWeek}
              min={1}
              max={7}
              onChange={(v) => setForm((f) => ({ ...f, targetPerWeek: v }))}
              format={(v) => (v === 7 ? 'har kuni' : `${v} marta`)}
            />
          </Row>

          <Txt variant="caption" tone="faint">
            Qachon (ixtiyoriy)
          </Txt>
          <View style={styles.chipsInline}>
            <Chip label="Istalgan vaqt" selected={form.block === null} onPress={() => setForm((f) => ({ ...f, block: null }))} />
            {BLOCKS.map((b: BlockId) => (
              <Chip key={b} label={BLOCK_LABEL[b]} selected={form.block === b} onPress={() => setForm((f) => ({ ...f, block: b }))} />
            ))}
          </View>

          <Row style={{ gap: space.sm }}>
            {editingId && (
              <View style={{ flex: 1 }}>
                <Button title="Bekor" kind="secondary" onPress={reset} />
              </View>
            )}
            <View style={{ flex: 2 }}>
              <Button title={editingId ? 'Saqlash' : 'Qoʻshish'} kind="primary" disabled={!form.title.trim()} onPress={save} />
            </View>
          </Row>
        </View>
      </View>

      {!editingId && suggestions.length > 0 && (
        <>
          <Txt variant="caption" tone="faint" style={styles.sugTitle}>
            Siz aytgan maqsadlardan — bosing, formaga tushadi:
          </Txt>
          <View style={styles.chips}>
            {suggestions.map((s) => (
              <Chip key={s.title} label={`${s.title}${s.kind === 'avoid' ? '' : s.targetPerWeek < 7 ? ` · ${s.targetPerWeek}×` : ''}`} selected={false} onPress={() => setForm(s)} />
            ))}
          </View>
        </>
      )}

      {/* ── Roʻyxat ── */}
      <SectionTitle>Faol odatlar</SectionTitle>
      {active.length === 0 ? (
        <Txt variant="caption" tone="faint" style={styles.sugTitle}>
          Hali odat yoʻq.
        </Txt>
      ) : (
        <Group>
          {active.map((h, i) => (
            <View key={h.id}>
              {i > 0 && <Divider inset={space.lg} />}
              <ListRow
                title={h.title}
                hint={`${h.kind === 'avoid' ? 'tiyilish' : 'qilish'} · ${h.targetPerWeek === 7 ? 'har kuni' : `haftada ${h.targetPerWeek}`}${h.block ? ` · ${BLOCK_LABEL[h.block]}` : ''}`}
                tone={editingId === h.id ? 'accent' : 'default'}
                right={
                  <Tap onPress={() => archive(h)} hitSlop={8}>
                    <Txt variant="label" tone="faint">
                      Arxiv
                    </Txt>
                  </Tap>
                }
                onPress={() => edit(h)}
              />
            </View>
          ))}
        </Group>
      )}

      {archived.length > 0 && (
        <>
          <Spacer size={space.lg} />
          <Tap onPress={() => setShowArchive(!showArchive)} style={{ alignSelf: 'flex-start' }}>
            <Txt variant="label" tone="faint" style={styles.sugTitle}>
              Arxiv ({archived.length}) {showArchive ? '▴' : '▾'}
            </Txt>
          </Tap>
          {showArchive && (
            <Group>
              {archived.map((h, i) => (
                <View key={h.id}>
                  {i > 0 && <Divider inset={space.lg} />}
                  <ListRow title={h.title} tone="muted" right="Qaytarish" onPress={() => archiveHabit(h.id, false)} />
                </View>
              ))}
            </Group>
          )}
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.lg },
  intro: { paddingHorizontal: space.xl, paddingTop: space.md },
  form: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  input: { ...type.bodyMedium, color: color.text, paddingHorizontal: space.lg, paddingVertical: space.lg },
  formBody: { padding: space.lg, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg },
  chipsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sugTitle: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
});
