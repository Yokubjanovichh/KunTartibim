import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { permissionStatus } from '../lib/notifications';
import { isBatteryOptimized } from '../lib/system';
import { useSettings } from './useData';

export interface SetupState {
  loading: boolean;
  notifications: boolean;
  canAskNotifications: boolean;
  /** null — aniqlab boʻlmadi */
  batteryFree: boolean | null;
  huaweiLaunch: boolean;
  /** Bajarilmagan qadamlar soni */
  missing: number;
  refresh: () => void;
}

/**
 * Eslatmalar ishonchli kelishi uchun kerakli sozlamalar holati.
 * Foydalanuvchi tizim sozlamalaridan qaytganda (ilova oldinga chiqqanda) qayta tekshiriladi.
 */
export function useSetupState(): SetupState {
  const settings = useSettings();
  const [state, setState] = useState({
    loading: true,
    notifications: false,
    canAskNotifications: true,
    batteryFree: null as boolean | null,
  });

  const refresh = useCallback(() => {
    (async () => {
      const [perm, optimized] = await Promise.all([permissionStatus(), isBatteryOptimized()]);
      setState({
        loading: false,
        notifications: perm.granted,
        canAskNotifications: perm.canAsk,
        batteryFree: optimized === null ? null : !optimized,
      });
    })();
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const missing =
    (state.notifications ? 0 : 1) + (state.batteryFree === false ? 1 : 0) + (settings.huaweiLaunchDone ? 0 : 1);

  return { ...state, huaweiLaunch: settings.huaweiLaunchDone, missing, refresh };
}
