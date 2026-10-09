/**
 * Migratsiyalar — versiyalangan SQL, `PRAGMA user_version` zanjiri.
 *
 * QOIDA: mavjud migratsiyani hech qachon oʻzgartirmang — faqat yangisini qoʻshing.
 * OTA yangilanish eski bazani aynan shu zanjir orqali yangi sxemaga olib oʻtadi,
 * shuning uchun ilovani oʻchirmasdan yangilaganda maʼlumot saqlanib qoladi.
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
];
