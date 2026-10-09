# Kun tartibim

Personal Android app for one user (Huawei nova 11, EMUI 14.2, no Google services):
namoz times for Toʻraqoʻrgʻon with reminders, "oʻqidim" confirmation, automatic qazo
list, and — in later phases — yearly/monthly/weekly/daily plans. UI language: Uzbek
(Latin, with ʻ U+02BB in oʻ/gʻ). The phone's system UI is in Russian, so Huawei
settings paths are written in Russian ("Настройки → Батарея → Запуск приложений").

Expo SDK 56 — same stack as `../MoliyamApp/moliyam`, which is proven on this phone.
Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before using an API.

## Commands

```
npm test                 # pure logic tests (tsx), TZ forced to Asia/Tashkent
npm run typecheck        # app + tests (tests have their own tsconfig with node types)
npm run export:android   # Metro bundle check, --max-workers 1 (low-RAM safe)
npm run icons            # regenerate assets/images/* (pure Node PNG renderer)
```

`npx expo …` fails on this Windows machine — use `./node_modules/.bin/expo …`.

## Shipping changes WITHOUT reinstalling (user requirement)

- **JS/asset-only change → OTA:**
  ```
  npm run export:android
  npx eas-cli update --branch preview --environment preview --platform android \
    --skip-bundler --input-dir dist --message "..." --non-interactive
  ```
  `--platform android` is mandatory (web bundle would fail on expo-sqlite).
- **Native change (new native package, app.json plugin/permission change) → new APK:**
  bump `expo.version` in app.json FIRST (runtimeVersion policy is `appVersion`, so old
  APKs never receive an incompatible OTA), then
  `npx eas-cli build --profile preview --platform android --non-interactive`.
  The new APK installs over the old one (same EAS keystore) — data is kept.
- The first APK already contains native modules planned for phases 2–4 (file system,
  sharing, document picker, svg, intent launcher, battery) so those phases can ship OTA.

## Architecture

- `src/lib/prayer-times.ts` — on-device calculation with the official islom.uz
  parameters (adhan `Other()`, fajr/isha 15.5°, Hanafi, Shom = sunset + 4 min). No API
  dependency; `src/lib/verify.ts` compares against Aladhan on demand.
- **Prayer day** = date of its Bomdod. Xufton/Vitr of day D last until Bomdod of D+1.
  `PrayerCalendar.prayerDayAt(now)` returns yesterday between midnight and Bomdod.
- `prayer_log` stores only facts (`prayed` | `qazo`). Other states are derived from time
  (`status.ts`). `reconcile()` turns ended, unmarked windows into `qazo` (source `auto`);
  prayers whose window started before `tracking_start` are never auto-qazo.
- Qazo balance is never stored: `COUNT(qazo rows) + SUM(qazo_entries.delta)`.
  Correcting qazo→prayed adds a `correction` entry if the balance would go negative.
- Notifications: `schedule.ts` builds a pure plan (10 days ≈ 110 alarms);
  `notifications.ts` diffs it against scheduled ones by id + content hash (`data.h`).
  Exact timing needs SCHEDULE_EXACT_ALARM + USE_EXACT_ALARM in app.json —
  expo-notifications silently falls back to inexact alarms without them.
- Notification buttons run in a headless JS task when the app is not in the
  foreground (expo-notifications 56: `ExpoHandlingDelegate` → `runTaskManagerTasks`).
  The task is defined in `src/lib/background.ts`, imported by `index.ts` BEFORE
  `expo-router/entry` — route files are not loaded in headless mode.
  Both the task and the foreground listener may receive the same press →
  `claimResponse()` dedupes via `handled_responses`.
- Data changes call `emitChange()`; screens read through `useDataVersion()`.
  React Compiler is deliberately OFF (in MoliyamApp it memoized DB reads into stale lists).

## Conventions

- Dates are local ISO days (`'2026-10-09'`); times are `Date` / ISO timestamps.
- Migrations in `src/db/migrations.ts` are append-only (`PRAGMA user_version`).
- Colors/spacing/type only from `src/theme/tokens.ts`. Accent (amber) = "now",
  danger (red) = qazo. Monochrome, no shadows, no icon tabs — same family as MoliyamApp.
- The user rejects step-by-step wizards: everything on one screen.
- Keep features to what helps the user's own day; ask before adding extras.

## Pitfalls hit in this project

- **The headless task gets the RAW notification bundle**: scheduled notifications keep
  our payload only in `content.dataString` (NotificationSerializer.toBundle(request));
  JS maps it to `content.data` only on listener/getAll…/getPresented… paths. Always read
  payloads with `readData(content)` from `schedule.ts` — never `content.data` directly.
  The first build shipped with this bug (fixed by OTA 5e04aae9); the old "test
  notification" masked it, so the test now records which path handled the press
  (`lastTestAck()` → shown on the Setup screen).
- Git: public repo `Yokubjanovichh/KunTartibim` on GitHub. Commit BEFORE `eas build` /
  `eas update` — EAS records the commit hash, which is how we know what code is on the
  phone. The repo uses the GitHub noreply address as commit email (local config) — the
  user's real email must not appear in this public history. Never commit secrets.
  (The first APK build and OTA 5e04aae9 were made before git, with `EAS_NO_VCS=1`.)
- `.easignore` keeps tests/scripts out of build uploads.
- EAS project `@yokubjanovich/kuntartibim` (2a1c5d1b-ce60-4b29-8092-0a0bcdd632ae),
  channel/branch `preview`, keystore generated and stored by EAS.

## Pitfalls already hit (from MoliyamApp)

- `expo-router/ui` `asChild` children reject array styles — `StyleSheet.flatten` first.
- Raw SQL returns snake_case — always alias columns (`marked_at AS markedAt`).
- Don't declare `<Stack.Screen name="x">` before the route file exists.
