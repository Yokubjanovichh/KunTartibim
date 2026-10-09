# Kun tartibim

Namoz vaqtlari atrofida kunni boshqarish uchun shaxsiy Android ilova.
Toʻraqoʻrgʻon (Namangan viloyati) uchun sozlangan.

## Imkoniyatlar (1-bosqich)

- **Namoz vaqtlari internetsiz** — islom.uz (Oʻzbekiston musulmonlari idorasi) saytidagi
  hisoblashning oʻzi: `adhan`, Bomdod/Xufton 15,5°, Asr Hanafiy, Shom = quyosh botishi + 4 daqiqa.
  Istalgan payt Aladhan API bilan solishtirish mumkin.
- **Eslatmalar** — vaqt kirganda «Oʻqidim ✓» tugmasi bilan (ilova ochilmaydi), vaqt
  tugashidan oldin ogohlantirish, kun yakunida Xufton/Vitr tekshiruvi.
- **Qazo** — belgilanmagan namoz avtomatik qazoga yoziladi (Vitr bilan), eski qazolar
  hisoblagichi, kunlik qazo maqsadi.
- **Tahlil** — kun xulosasi, haftalik jadval va «zaif nuqta», 30 kunlik natija.
- **Masjid jadvaliga moslash** — har bir vaqtga ±daqiqa tuzatish.
- **Huawei (EMUI)** — eslatmalar oʻz vaqtida kelishi uchun bitta ekranlik sozlash roʻyxati.

## Texnologiya

Expo SDK 56 · React Native 0.85 · expo-router · expo-sqlite · expo-notifications +
expo-task-manager · EAS Build va EAS Update (ilovani oʻchirmasdan yangilash).

## Ishga tushirish

```bash
npm install
npm test               # mantiq testlari
npm run typecheck
npm run export:android # Android bundle tekshiruvi
```

APK EAS bulutida yigʻiladi (`eas build --profile preview --platform android`),
kod oʻzgarishlari esa `eas update` orqali telefonga yetib boradi.

## Reja

1. ✅ Namoz, qazo, tahlil
2. Kunlik reja — vazifalar namoz bloklari boʻyicha («Bomdoddan keyin», «Asrdan keyin»)
3. Haftalik, oylik, yillik maqsadlar (bogʻlash ixtiyoriy)
4. Statistika, bosh ekran vidjeti, zaxira nusxa
