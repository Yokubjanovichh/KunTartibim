# Kun tartibim (`reja/`)

Daily planner for the same single user as Namozim (the repo root — read `../AGENTS.md`
first: phone, language, shipping rules and pitfalls apply here too). Split out of the
original app on 2026-10-10: the user wants one purpose per app. **No prayer tracking
here** — Namozim owns namoz, qazo and the Bomdod alarm.

Separate Expo project: own `package.json` / `node_modules`, package
`uz.kuntartibim.reja`, scheme `kunreja`, EAS project `@yokubjanovich/kuntartibim-reja`
(channel/branch `preview`, its own cloud keystore). Same dependency set as Namozim (proven
on the phone; future phases can ship OTA).

## Commands (run from `reja/`)

```
npm test                 # tsx; TZ = Asia/Tashkent; DB tests on node:sqlite via tests/shims
npm run typecheck
npm run export:android   # Metro bundle check
npm run icons            # timeline glyph icons (scripts/make-icons.mjs)
```

OTA / APK commands are the same as in `../AGENTS.md`, executed in this folder. The git
root `.easignore` applies to this build too — never ignore `/reja` there.

## Architecture

- **Prayer times are only a clock here.** `prayer-times.ts` is a copy of Namozim's
  (islom.uz parameters); `calendar.ts` applies the adjustments imported from Namozim.
  Blocks (`blocks.ts`): Bomdoddan / Peshindan / Asrdan / Shomdan / Xuftondan keyin —
  tasks are planned relative to prayers and shift with them over the year. A task with
  an exact `time` gets its block from the time; times before Bomdod belong to the prayer
  day's night (`momentOnPrayerDay`). The day changes at Bomdod, not midnight.
- `plan.ts` — tasks (max 3 ★ per day, moved_count, backlog with `day = NULL`), habits
  (hidden until the user adds one — they asked to focus on daily planning first),
  `day_plans` ("Reja tayyor ✓" for tomorrow), `notes.ts` (day / `week:` notes).
- Today screen (`app/(tabs)/index.tsx`): one "Kun tartibi" — five prayer-time anchor rows
  (tap = add a task to that block), tasks nested under their block, the current block in
  accent with time left. Can browse 30 days back and 14 ahead.
- Tahlil (`review.tsx`, the user's most important section): close today (tasks first,
  "Ertaga" moves), day note, tomorrow's plan with ★ and planning streak, week stats, notes.
- Notifications (`schedule.ts` pure plan → `notifications.ts` diff by id + hash):
  `morning:<day>` "Bugungi reja" at Bomdod + 30 min (after prayer — never at the same
  minute as Namozim's prayer notification), `block:<day>:<block>` at prayer + 20 min with
  that block's open tasks (morning block folded into "Bugungi reja"), `task:<id>` with
  [Bajarildi ✓] [15 daqiqadan keyin], `review:<day>` "Kun yakuni" (default 22:00, ≥
  Xufton + 30), `sleep:<day>`. Channels: `ishlar` (tasks), `reja` (the rest).
- Headless notification task `kunreja-notification-action` (`background.ts`, imported in
  `index.ts` before expo-router). Payloads via `readData(content)` — never `content.data`.
- **Import from Namozim** (`transfer.ts`, route `app/import.tsx`): Namozim opens
  `kunreja://import?d=<base64url(JSON)>` (raw JSON starting with `{` is also accepted);
  we validate/sanitize, show a summary, write in one
  transaction. Dedupe: tasks and habits by (title, created_at), habit ids remapped,
  notes/plans `INSERT OR IGNORE`. Adjustments are always taken; reminder times only on the
  first import. Format must match Namozim's `src/lib/planner-export.ts`.

## UI rules (user feedback 2026-10-10: "uzun nom bitta qatorda, qoʻshish tugmasi noqulay, klaviatura hisobga olinmagan")

- Forms use `ui/form.tsx`: `FormScreen` (header + scroll with `keyboardShouldPersistTaps`
  + a primary button pinned at the bottom — the window resizes with the keyboard, as in
  MoliyamApp, so it sits right above it) and `TitleInput` (multiline, grows; Enter =
  submit, never a newline). Never put the main action at the end of a long scroll.
- The primary button says where the item goes ("Bugunga qoʻshish", "Ertaga qoʻshish").
- Task rows: the circle toggles done, the title opens edit, long press = quick actions.
  A tap anywhere must never silently complete a task.
- Today screen: "+ Ish qoʻshish" floats bottom-right (thumb reach); prayer-time rows add
  to their block. Batch entry (tomorrow's plan) keeps the keyboard open after each add.

## Next (phase 3)

Week / month / year goals with OPTIONAL links to tasks (user requirement: unlinked tasks
are first-class and must not distort goal percentages). Interview preparation is a natural
first goal. Everything must feed into Tahlil.
