import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Klaviatura ochiqmi. Oyna klaviatura bilan siqiladi (adjustResize), shuning uchun
 * pastki tugma oʻz-oʻzidan uning ustiga chiqadi — bu faqat ortiqcha pastki
 * boʻshliqni (navigatsiya paneli uchun) olib tashlashga kerak.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
