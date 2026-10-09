import { useEffect, useSyncExternalStore } from 'react';

import { checkAndDownload } from '../lib/updates';

/**
 * OTA yangilanish holati — ilova sessiyasida bir marta tekshiriladi va
 * hamma ekranlar bitta natijani koʻradi.
 */

type State = { ready: boolean; checking: boolean; error: string | null; checkedAt: Date | null };

let state: State = { ready: false, checking: false, error: null, checkedAt: null };
const listeners = new Set<() => void>();
let started = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export async function checkUpdateNow(): Promise<void> {
  if (state.checking) return;
  set({ checking: true, error: null });
  const res = await checkAndDownload();
  set({ checking: false, ready: state.ready || res.ready, error: res.error, checkedAt: new Date() });
}

export function useUpdateState(): State {
  useEffect(() => {
    if (!started) {
      started = true;
      checkUpdateNow();
    }
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
