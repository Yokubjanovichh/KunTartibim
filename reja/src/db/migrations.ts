/**
 * Migratsiyalar — versiyalangan SQL, `PRAGMA user_version` zanjiri.
 *
 * QOIDA: mavjud migratsiyani hech qachon oʻzgartirmang — faqat yangisini qoʻshing.
 * OTA yangilanish eski bazani aynan shu zanjir orqali yangi sxemaga olib oʻtadi,
 * shuning uchun ilovani oʻchirmasdan yangilaganda maʼlumot saqlanib qoladi.
 *
 * 1-versiya — Namozimdan ajralgandagi holat (oʻsha ilovaning 2–3-migratsiyalari
 * bilan bir xil jadvallar, shuning uchun koʻchirish ustunma-ustun).
 */

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: /* sql */ `
      CREATE TABLE IF NOT EXISTS settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );

      -- Bir martalik ish. day NULL = sanasiz ("keyinroq" roʻyxati).
      CREATE TABLE IF NOT EXISTS tasks (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        title          TEXT    NOT NULL,
        day            TEXT,                              -- namoz kuni (Bomdod sanasi)
        block          TEXT,                              -- kun boʻlagi: morning | noon | afternoon | evening | night
        time           TEXT,                              -- 'HH:MM' yoki NULL (boʻlak yetarli)
        remind_before  INTEGER,                           -- necha daqiqa oldin; NULL = eslatmasiz
        priority       INTEGER NOT NULL DEFAULT 0,        -- 1 = asosiy ish
        status         TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
        done_at        TEXT,
        moved_count    INTEGER NOT NULL DEFAULT 0,        -- necha marta keyingi kunga koʻchirilgan
        created_at     TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_day_idx ON tasks(day, status);

      -- Odat: "qilish" (zal, kitob) yoki "tiyilish" (Instagram, kino)
      CREATE TABLE IF NOT EXISTS habits (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        title            TEXT    NOT NULL,
        kind             TEXT    NOT NULL DEFAULT 'do' CHECK (kind IN ('do', 'avoid')),
        target_per_week  INTEGER NOT NULL DEFAULT 7,   -- 7 = har kuni, 3 = haftada 3 marta
        block            TEXT,                         -- ixtiyoriy kun boʻlagi
        sort_order       INTEGER NOT NULL DEFAULT 0,
        archived         INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT    NOT NULL
      );

      -- done = 1: bajarildi / tiyildi; done = 0: bajarilmadi / tiyilmadi.
      -- Yozuv yoʻq = belgilanmagan.
      CREATE TABLE IF NOT EXISTS habit_log (
        habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        day       TEXT    NOT NULL,
        done      INTEGER NOT NULL,
        at        TEXT    NOT NULL,
        PRIMARY KEY (habit_id, day)
      );

      -- Kechqurun "Reja tayyor" bosilgan: day = REJA QILINGAN (ertangi) kun
      CREATE TABLE IF NOT EXISTS day_plans (
        day         TEXT PRIMARY KEY,
        planned_at  TEXT NOT NULL
      );

      -- Kun va hafta xulosalari: kalit — kun ('2026-10-10') yoki hafta ('week:2026-10-05')
      CREATE TABLE IF NOT EXISTS day_notes (
        day         TEXT PRIMARY KEY,
        text        TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      -- Bildirishnoma tugmasi ikki marta ishlamasligi uchun (fon vazifasi va
      -- ochiq ilova tinglovchisi bir xil bosishni ikkalasi ham olishi mumkin)
      CREATE TABLE IF NOT EXISTS handled_responses (
        key  TEXT PRIMARY KEY,
        at   TEXT NOT NULL
      );
    `,
  },
];
