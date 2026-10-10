/**
 * «Kun tartibim»ga koʻchirish tugmasi — Bugun ekranidagi eslatma va Sozlamalar
 * bir xil yoʻldan oʻtadi: havola ochiladi, «Kun tartibim» koʻrsatib, tasdiqlatib yozadi.
 */

import { Alert, Linking } from 'react-native';

import { markPlannerMoved, plannerImportUrl } from '../lib/planner-export';

export async function moveToPlanner(): Promise<void> {
  try {
    await Linking.openURL(plannerImportUrl());
  } catch {
    Alert.alert(
      '«Kun tartibim» topilmadi',
      'Avval «Kun tartibim» ilovasini oʻrnating, keyin shu tugmani yana bosing. Maʼlumotlar shu yerda saqlanib turibdi.',
      [{ text: 'Yaxshi' }],
      { cancelable: true },
    );
    return;
  }
  markPlannerMoved();
}
