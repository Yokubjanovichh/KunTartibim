import { useMemo, useSyncExternalStore } from 'react';

import { getVersion, subscribe } from '../lib/events';
import { type AppSettings, loadSettings } from '../lib/settings';

/** Bazadagi har bir oʻzgarishda oshadigan hisoblagich — oʻqishlarni shunga bogʻlang */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export function useSettings(): AppSettings {
  const version = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => loadSettings(), [version]);
}
