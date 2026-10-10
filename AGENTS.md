# Namozim (+ «Kun tartibim» in `reja/`)

Two personal Android apps for one user (Huawei nova 11, EMUI 14.2, no Google services).
Until 2026-10-10 they were one app; the user asked to split it — one purpose per app,
like MoliyamApp ("har bittasi alohida app … ishlatish ham tushunish ham oson").

- **This folder = Namozim** — namoz times for Toʻraqoʻrgʻon with reminders, "oʻqidim"
  confirmation, automatic qazo list, Bomdod alarm. It is the ORIGINAL install
  (package `uz.kuntartibim.app`, EAS project `kuntartibim`), so namoz data, Huawei
  permissions and the alarm stayed in place; only the launcher name changed (1.2.0).
- **`reja/` = Kun tartibim** — daily planning (tasks under prayer-time blocks, evening
  plan, habits; week/month/year goals next). A fully separate Expo project: own
  package.json/node_modules, package `uz.kuntartibim.reja`, EAS project
  `kuntartibim-reja`. Read `reja/AGENTS.md` before working there. Don't add planning
  features back here.

UI language: Uzbek (Latin, with ʻ U+02BB in oʻ/gʻ). The phone's system UI is in Russian,
so Huawei settings paths are written in Russian ("Настройки → Батарея → Запуск приложений").

Expo SDK 56 — same stack as `../MoliyamApp/moliyam`, which is proven on this phone.
Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before using an API.

## Commands

```
npm test                 # logic + DB tests (tsx), TZ forced to Asia/Tashkent;
                         # DB tests run the real tracker.ts/planner-export.ts on node:sqlite
                         # via tests/shims (expo-sqlite is redirected there)
npm run typecheck        # app + tests (tests have their own tsconfig with node types)
npm run export:android   # Metro bundle check, --max-workers 1 (low-RAM safe)
npm run icons            # regenerate assets/images/* (pure Node PNG renderer)
```

`npx expo …` fails on this Windows machine — use `./node_modules/.bin/expo …`.
The same commands exist in `reja/` (run them from there). `metro.config.js` and
`tsconfig.json` here exclude `reja/` — otherwise Metro/tsc crawl its node_modules.

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
  `reja/` has the same dependency set for the same reason.
- **`.easignore` at the GIT ROOT applies to builds of BOTH apps** (eas-cli archives
  `git rev-parse --show-toplevel`). Never add `/reja` to it — the planner build would
  upload without its own sources. Anchored paths like `/reja/tests` are fine.

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
- **Planning moved to `reja/` (2026-10-10).** The `tasks`, `habits`, `habit_log`,
  `day_plans`, `day_notes` tables still exist here (migrations are append-only) but the
  UI no longer reads them. `planner-export.ts` sends their rows to Kun tartibim via a
  deep link `kunreja://import?d=<encodeURIComponent(JSON)>` (no file picking; the
  planner shows a summary, asks to confirm and dedupes repeats). The payload format must
  match `reja/src/lib/transfer.ts` — `tests/db.test.ts` pins the field names. The Today
  screen shows a one-time "Koʻchirish" notice; Settings keeps a re-send row.
- The evening notification is now only "Uxlashdan oldin" (Xufton/Vitr unmarked, default
  22:30 — the planner's "Kun yakuni" is at 22:00). Prayer notifications no longer list
  tasks; the old `ishlar` channel and `task` category are deleted on start.
- **Bomdod alarm — the only custom native code** (`modules/bomdod-alarm`, local Expo
  module, autolinked from `./modules`, Kotlin, added in app version 1.1.0). JS computes
  the next 14 days of alarm times (`alarm-plan.ts`, adhan stays in JS) and hands them to
  native (`setSchedule`); native keeps them in SharedPreferences and chains itself:
  `setAlarmClock` → `AlarmReceiver` → foreground `AlarmService` (looping alarm ringtone
  on the ALARM stream with volume ramp, vibration, full-screen-intent notification) →
  `AlarmActivity` over the lock screen ([Turdim] / [N daqiqadan keyin] / optional math
  challenge). After "Turdim" a wake-up check fires `alarmCheckDelay` min later (user
  asked for 15 — time to do wudu); no answer → rings again, and an unanswered ring
  auto-snoozes within the shared `maxSnoozes` budget (the goal is waking, so the recheck
  phase snoozes too). Nothing rings after sunrise (`endAt`) — `AlarmControl.expire`.
  Marking Bomdod as prayed calls `confirmAwake()` during sync (never clears a ringing or
  *test* session — JS syncs run on every data change and would kill the 30-s test).
  If Android refuses the foreground service, `startFallback` posts an insistent
  alarm-sound notification with the same full-screen intent. While ringing, the ALARM
  stream is raised to ≥70% and restored afterwards. `BootReceiver` restores the next alarm.
  A wake log feeds Tahlil ("Uygʻonish": turdi / qayta uxlab qoldi (`asleep`) / javobsiz).
  JS loads the module with `requireOptionalNativeModule` — absent module ⇒ all no-ops.
  **Any change under `modules/` needs a new APK** (bump `expo.version` once a build with
  that version has been installed). Kotlin is compiled only on EAS (no local Android
  SDK) — review it carefully.
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
- `.easignore` keeps tests/scripts out of build uploads (see the git-root note above).
- Shell heredocs in this environment collapse a doubled backslash into a single one —
  write files that contain backslashes (regexes, JSX `{'\n'}`) with an editor tool,
  not `cat <<EOF` or inline Python.
- **Foreground service contract** (`AlarmService`): a service started with
  `startForegroundService()` must call `startForeground()` — even `stopSelf()` before it
  crashes the app. So `startForeground` is the FIRST thing in `onStartCommand`, the session
  check comes after it, and both the start call and `startForeground` are wrapped in
  try/catch (background-start refusal → `startFallback`).
- **`handler.removeCallbacksAndMessages(null)` removes every runnable** — in the first
  1.1.0 build it ran right after `startSound()` and killed the volume ramp, so the alarm
  would have stayed at 20% volume. Clear first, then post; the timeout is an explicit
  `Runnable` field.
- **Android `Alert` shows at most 3 buttons** (`buttons.slice(0, 3)` — the rest are
  silently dropped) and is not dismissable by tapping outside unless
  `{ cancelable: true }`. Menus without a "Bekor" button must pass it.
- EAS project `@yokubjanovich/kuntartibim` (2a1c5d1b-ce60-4b29-8092-0a0bcdd632ae),
  channel/branch `preview`, keystore generated and stored by EAS.

## Pitfalls already hit (from MoliyamApp)

- `expo-router/ui` `asChild` children reject array styles — `StyleSheet.flatten` first.
- Raw SQL returns snake_case — always alias columns (`marked_at AS markedAt`).
- Don't declare `<Stack.Screen name="x">` before the route file exists.
