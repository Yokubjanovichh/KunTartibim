package expo.modules.bomdodalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** JS tuzib bergan budilnik: aniq vaqt va Bomdod oynasining oxiri (quyosh chiqishi) */
internal data class AlarmItem(val at: Long, val endAt: Long, val title: String, val body: String)

internal data class AlarmConfig(
  val snoozeMinutes: Int = 5,
  val maxSnoozes: Int = 2,
  val checkEnabled: Boolean = true,
  val checkDelayMinutes: Int = 15,
  val recheckMinutes: Int = 3,
  val challenge: Boolean = false,
  val ringMinutes: Int = 5,
)

/**
 * Joriy chalinish. Asl budilnik vaqti (at) keyinga surishlar va uygʻonish
 * tekshiruvi davomida oʻzgarmaydi — jurnal shu boʻyicha yoziladi.
 */
internal data class Session(
  val at: Long,
  val endAt: Long,
  val title: String,
  val body: String,
  val firedAt: Long,
  val snoozes: Int = 0,
  val test: Boolean = false,
  val logged: Boolean = false,
  val rechecked: Boolean = false,
)

/**
 * Hammasi SharedPreferences'da: ilova jarayoni oʻlgan boʻlsa ham (budilnik
 * paytida odatda shunday) receiver va xizmat kerakli maʼlumotni topadi.
 * commit() — sinxron: receiver tugashi bilan jarayon oʻldirilishi mumkin.
 */
internal object AlarmStore {
  private const val PREFS = "kuntartibim_bomdod_alarm"
  private const val LOG_LIMIT = 90

  private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /* ── Jadval ── */

  fun saveSchedule(c: Context, items: List<AlarmItem>) {
    val arr = JSONArray()
    for (it in items.sortedBy { item -> item.at }) {
      arr.put(
        JSONObject()
          .put("at", it.at)
          .put("endAt", it.endAt)
          .put("title", it.title)
          .put("body", it.body),
      )
    }
    prefs(c).edit().putString("schedule", arr.toString()).commit()
  }

  fun schedule(c: Context): List<AlarmItem> {
    val raw = prefs(c).getString("schedule", null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        AlarmItem(
          o.getLong("at"),
          o.optLong("endAt", 0L),
          o.optString("title", "Bomdod vaqti"),
          o.optString("body", ""),
        )
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  /** Shu vaqtgacha boʻlgan (chalingan yoki oʻtib ketgan) budilniklarni olib tashlaydi */
  fun dropThrough(c: Context, at: Long) {
    saveSchedule(c, schedule(c).filter { it.at > at })
  }

  /* ── Sozlamalar ── */

  fun saveConfig(c: Context, cfg: AlarmConfig) {
    prefs(c).edit()
      .putInt("snoozeMinutes", cfg.snoozeMinutes)
      .putInt("maxSnoozes", cfg.maxSnoozes)
      .putBoolean("checkEnabled", cfg.checkEnabled)
      .putInt("checkDelayMinutes", cfg.checkDelayMinutes)
      .putInt("recheckMinutes", cfg.recheckMinutes)
      .putBoolean("challenge", cfg.challenge)
      .putInt("ringMinutes", cfg.ringMinutes)
      .commit()
  }

  fun config(c: Context): AlarmConfig {
    val p = prefs(c)
    val d = AlarmConfig()
    return AlarmConfig(
      snoozeMinutes = p.getInt("snoozeMinutes", d.snoozeMinutes).coerceIn(1, 30),
      maxSnoozes = p.getInt("maxSnoozes", d.maxSnoozes).coerceIn(0, 5),
      checkEnabled = p.getBoolean("checkEnabled", d.checkEnabled),
      checkDelayMinutes = p.getInt("checkDelayMinutes", d.checkDelayMinutes).coerceIn(1, 30),
      recheckMinutes = p.getInt("recheckMinutes", d.recheckMinutes).coerceIn(1, 15),
      challenge = p.getBoolean("challenge", d.challenge),
      ringMinutes = p.getInt("ringMinutes", d.ringMinutes).coerceIn(1, 15),
    )
  }

  /* ── Joriy chalinish ── */

  fun saveSession(c: Context, s: Session?) {
    val e = prefs(c).edit()
    if (s == null) {
      e.remove("session")
    } else {
      e.putString(
        "session",
        JSONObject()
          .put("at", s.at)
          .put("endAt", s.endAt)
          .put("title", s.title)
          .put("body", s.body)
          .put("firedAt", s.firedAt)
          .put("snoozes", s.snoozes)
          .put("test", s.test)
          .put("logged", s.logged)
          .put("rechecked", s.rechecked)
          .toString(),
      )
    }
    e.commit()
  }

  fun session(c: Context): Session? {
    val raw = prefs(c).getString("session", null) ?: return null
    return try {
      val o = JSONObject(raw)
      Session(
        at = o.getLong("at"),
        endAt = o.optLong("endAt", 0L),
        title = o.optString("title", "Bomdod vaqti"),
        body = o.optString("body", ""),
        firedAt = o.optLong("firedAt", o.getLong("at")),
        snoozes = o.optInt("snoozes", 0),
        test = o.optBoolean("test", false),
        logged = o.optBoolean("logged", false),
        rechecked = o.optBoolean("rechecked", false),
      )
    } catch (e: Exception) {
      null
    }
  }

  /* ── Uygʻonish jurnali (Tahlil uchun) ── */

  private fun readLog(c: Context): JSONArray =
    try {
      JSONArray(prefs(c).getString("log", "[]"))
    } catch (e: Exception) {
      JSONArray()
    }

  private fun writeLog(c: Context, arr: JSONArray) {
    val trimmed = JSONArray()
    val start = maxOf(0, arr.length() - LOG_LIMIT)
    for (i in start until arr.length()) trimmed.put(arr.get(i))
    prefs(c).edit().putString("log", trimmed.toString()).commit()
  }

  /** dismissedAt = 0 — budilnik javobsiz tugadi (uygʻonmagan) */
  fun appendLog(c: Context, s: Session, dismissedAt: Long) {
    val arr = readLog(c)
    arr.put(
      JSONObject()
        .put("at", s.at)
        .put("firedAt", s.firedAt)
        .put("dismissedAt", dismissedAt)
        .put("snoozes", s.snoozes)
        .put("rechecked", false),
    )
    writeLog(c, arr)
  }

  /** Tekshiruvga javob bermagani uchun budilnik qayta chaldi — oxirgi yozuvni yangilaymiz */
  fun markLastRechecked(c: Context, at: Long, dismissedAt: Long) {
    val arr = readLog(c)
    for (i in arr.length() - 1 downTo 0) {
      val o = arr.getJSONObject(i)
      if (o.optLong("at") == at) {
        o.put("rechecked", true)
        o.put("dismissedAt", dismissedAt)
        break
      }
    }
    writeLog(c, arr)
  }

  fun log(c: Context): List<Map<String, Any>> {
    val arr = readLog(c)
    return (0 until arr.length()).map { i ->
      val o = arr.getJSONObject(i)
      mapOf(
        "at" to o.optLong("at").toDouble(),
        "firedAt" to o.optLong("firedAt").toDouble(),
        "dismissedAt" to o.optLong("dismissedAt").toDouble(),
        "snoozes" to o.optInt("snoozes"),
        "rechecked" to o.optBoolean("rechecked"),
      )
    }
  }
}
