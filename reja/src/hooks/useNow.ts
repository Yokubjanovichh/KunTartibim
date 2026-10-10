import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Joriy vaqt — `intervalMs` chegarasiga tekislangan holda yangilanadi va ilova
 * oldinga chiqqanda darhol yangilanadi (telefon uxlab qolgan boʻlishi mumkin).
 */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, intervalMs - (Date.now() % intervalMs) + 50);
    };
    schedule();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}
