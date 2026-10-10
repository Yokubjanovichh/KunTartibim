# Namozim va Kun tartibim

Toʻraqoʻrgʻon (Namangan viloyati) uchun ikkita shaxsiy Android ilova. Avval bitta
ilova edi; 2026-10-10 da ikkiga boʻlindi — har biri bitta ish qiladi (MoliyamApp kabi).

| | **Namozim** (shu papka) | **Kun tartibim** (`reja/`) |
|---|---|---|
| Nima | namoz vaqtlari, «oʻqidim», qazo, Bomdod budilnigi | kunlik reja: ishlar namoz boʻlaklari ostida, ertangi reja, odatlar |
| Tahlil | namoz jadvali, zaif nuqta, uygʻonish jurnali | kun yakuni, ertangi reja, hafta natijasi va xulosalar |
| Paket | `uz.kuntartibim.app` | `uz.kuntartibim.reja` |

## Namozim

- **Namoz vaqtlari internetsiz** — islom.uz (Oʻzbekiston musulmonlari idorasi) saytidagi
  hisoblashning oʻzi: `adhan`, Bomdod/Xufton 15,5°, Asr Hanafiy, Shom = quyosh botishi + 4 daqiqa.
  Istalgan payt Aladhan API bilan solishtirish mumkin.
- **Eslatmalar** — vaqt kirganda «Oʻqidim ✓» tugmasi bilan (ilova ochilmaydi), vaqt
  tugashidan oldin ogohlantirish, uxlashdan oldin Xufton/Vitr tekshiruvi.
- **Bomdod budilnigi** — qulf ekrani ustida chaladi; «Turdim»dan 15 daqiqa keyin «Turdingizmi?».
- **Qazo** — belgilanmagan namoz avtomatik qazoga yoziladi (Vitr bilan), eski qazolar
  hisoblagichi, kunlik qazo maqsadi.
- **Masjid jadvaliga moslash** — har bir vaqtga ±daqiqa tuzatish.
- **Huawei (EMUI)** — eslatmalar oʻz vaqtida kelishi uchun bitta ekranlik sozlash roʻyxati.

## Kun tartibim

- **Kun namoz vaqtlariga tayanadi** — ish «soat 16:00» emas, «Asrdan keyin» deb rejalanadi
  va yil davomida namoz vaqtlari bilan birga siljiydi. Xohlasangiz aniq vaqt va eslatma.
- **Ertalab «Bugungi reja»**, boʻlak boshlanganda oʻsha boʻlak ishlari, kechqurun kun yakuni.
- **Ertangi reja** — kechqurun 2 daqiqada; ★ asosiy ishlar (3 tagacha), reja tuzish seriyasi.
- Namozim'dagi eski ishlar bir bosishda koʻchiriladi (`kunreja://import`).

## Texnologiya

Expo SDK 56 · React Native 0.85 · expo-router · expo-sqlite · expo-notifications +
expo-task-manager · EAS Build va EAS Update (ilovani oʻchirmasdan yangilash).
Namozim'da bitta native modul bor — Bomdod budilnigi (`modules/bomdod-alarm`, Kotlin).

## Ishga tushirish

```bash
npm install && npm test && npm run typecheck        # Namozim
cd reja && npm install && npm test && npm run typecheck  # Kun tartibim
npm run export:android                               # Android bundle tekshiruvi (har birida)
```

APK EAS bulutida yigʻiladi (`eas build --profile preview --platform android`, oʻsha ilova
papkasida), kod oʻzgarishlari esa `eas update` orqali telefonga yetib boradi.

## Reja

1. ✅ Namoz, qazo, tahlil, Bomdod budilnigi (Namozim)
2. ✅ Kunlik reja — ishlar namoz boʻlaklari boʻyicha (Kun tartibim)
3. Haftalik, oylik, yillik maqsadlar (bogʻlash ixtiyoriy) — Kun tartibim
4. Statistika, bosh ekran vidjeti, zaxira nusxa
