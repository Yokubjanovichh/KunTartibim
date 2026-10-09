/**
 * Migratsiyalar — versiyalangan SQL, `PRAGMA user_version` zanjiri.
 *
 * QOIDA: mavjud migratsiyani hech qachon oʻzgartirmang — faqat yangisini qoʻshing.
 * OTA yangilanish eski bazani aynan shu zanjir orqali yangi sxemaga olib oʻtadi,
 * shuning uchun ilovani oʻchirmasdan yangilaganda maʼlumot saqlanib qoladi.
 */

export const SCHEMA_VERSION = 2;

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: /* sql */ `
      CREATE TABLE IF NOT EXISTS settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );

      -- Faqat aniq faktlar: oʻqildi yoki qazo. "Vaqti kirmagan / davom etyapti"
      -- holatlari saqlanmaydi — ular vaqtdan hisoblanadi.
      CREATE TABLE IF NOT EXISTS prayer_log (
        day        TEXT NOT NULL,                 -- namoz kuni (Bomdod sanasi)
        prayer     TEXT NOT NULL,                 -- bomdod | peshin | asr | shom | xufton | vitr
        status     TEXT NOT NULL CHECK (status IN ('prayed', 'qazo')),
        source     TEXT NOT NULL DEFAULT 'app',   -- app | notification | auto | review
        marked_at  TEXT NOT NULL,
        PRIMARY KEY (day, prayer)
      );
      CREATE INDEX IF NOT EXISTS prayer_log_status_idx ON prayer_log(status, prayer);

      -- Qazo hisobining qoʻlda oʻzgarishlari:
      --   old        +N  eski (kuzatuvdan oldingi) qazolar
      --   makeup     −N  qazosi oʻqildi
      --   correction ±N  tuzatish (masalan, qazo deb belgilangan namoz aslida oʻqilgan)
      -- Qoldiq = qazo yozuvlari soni + SUM(delta).
      CREATE TABLE IF NOT EXISTS qazo_entries (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        prayer      TEXT    NOT NULL,
        delta       INTEGER NOT NULL,
        kind        TEXT    NOT NULL CHECK (kind IN ('old', 'makeup', 'correction')),
        created_at  TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS qazo_entries_prayer_idx ON qazo_entries(prayer);

      -- Kun yakunidagi qisqa xulosa (Tahlil ekrani)
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
  {
    // 2-bosqich: odatlar, vazifalar, kechki reja
    version: 2,
    sql: /* sql */ `
      -- Odat: "qilish" (zal, kitob) yoki "tiyilish" (Instagram, kino)
      CREATE TABLE IF NOT EXISTS habits (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        title            TEXT    NOT NULL,
        kind             TEXT    NOT NULL DEFAULT 'do' CHECK (kind IN ('do', 'avoid')),
        target_per_week  INTEGER NOT NULL DEFAULT 7,   -- 7 = har kuni, 3 = haftada 3 marta
        block            TEXT,                         -- ixtiyoriy namoz bloki
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

      -- Bir martalik ish. day NULL = sanasiz ("keyinroq" roʻyxati).
      CREATE TABLE IF NOT EXISTS tasks (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL,
        day          TEXT,
        block        TEXT,
        priority     INTEGER NOT NULL DEFAULT 0,       -- 1 = asosiy ish
        status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
        done_at      TEXT,
        moved_count  INTEGER NOT NULL DEFAULT 0,       -- necha marta keyingi kunga koʻchirilgan
        created_at   TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_day_idx ON tasks(day, status);

      -- Kechqurun "Reja tayyor" bosilgan: day = REJA QILINGAN (ertangi) kun
      CREATE TABLE IF NOT EXISTS day_plans (
        day         TEXT PRIMARY KEY,
        planned_at  TEXT NOT NULL
      );
    `,
  },
];
