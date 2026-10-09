package expo.modules.bomdodalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Budilnik mantigʻi — oyna, bildirishnoma tugmalari va xizmat taymeri bir xil
 * yoʻldan oʻtadi:
 *   dismiss  — "Turdim": ovoz toʻxtaydi, jurnalga yoziladi, N daqiqadan keyin tekshiruv
 *   snooze   — "N daqiqa": cheklangan marta (javobsiz chalib tugasa ham shunday)
 *   showCheck → "Turdingizmi?"; javob boʻlmasa recheck — budilnik qayta chaladi
 *   confirmAwake — "Ha, turdim" yoki Bomdod "oʻqildi" deb belgilanganda (JS'dan)
 *   expire   — quyosh chiqdi: Bomdod vaqti tugagan, endi chalinmaydi
 */
internal object AlarmControl {
  private const val CHECK_CHANNEL = "bomdod_tekshiruv"
  private const val FALLBACK_CHANNEL = "bomdod_budilnik_zaxira"
  const val CHECK_NOTIF_ID = 7202
  private const val FALLBACK_NOTIF_ID = 7203
  private const val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  private const val RECHECK_TITLE = "Hali turmadingizmi?"

  fun startRinging(c: Context, kind: String) {
    val intent = Intent(c, AlarmService::class.java).putExtra(AlarmReceiver.EXTRA_KIND, kind)
    try {
      ContextCompat.startForegroundService(c, intent)
    } catch (e: Exception) {
      // Android fondan xizmat ochishga ruxsat bermadi (masalan, aniq budilnik ruxsati
      // olib qoʻyilgan) — ilova yiqilmasin, budilnik zaxira yoʻl bilan baribir chalsin
      startFallback(c, kind)
    }
  }

  private fun stopRinging(c: Context) {
    c.stopService(Intent(c, AlarmService::class.java))
    NotificationManagerCompat.from(c).cancel(FALLBACK_NOTIF_ID)
    AlarmActivity.finishCurrent()
  }

  fun canSnooze(c: Context): Boolean {
    val s = AlarmStore.session(c) ?: return false
    if (s.test) return false
    return s.snoozes < AlarmStore.config(c).maxSnoozes
  }

  fun snooze(c: Context) {
    val s = AlarmStore.session(c)
    if (s == null) {
      stopRinging(c)
      return
    }
    val cfg = AlarmStore.config(c)
    if (s.test || s.snoozes >= cfg.maxSnoozes) {
      dismiss(c)
      return
    }
    stopRinging(c)
    AlarmStore.saveSession(c, s.copy(snoozes = s.snoozes + 1))
    AlarmScheduler.scheduleKind(
      c,
      System.currentTimeMillis() + cfg.snoozeMinutes * 60_000L,
      AlarmReceiver.KIND_SNOOZE,
      AlarmScheduler.REQ_SNOOZE,
    )
  }

  fun dismiss(c: Context) {
    stopRinging(c)
    AlarmScheduler.cancel(c, AlarmReceiver.ACTION_FIRE, AlarmScheduler.REQ_SNOOZE)
    val s = AlarmStore.session(c) ?: return
    if (s.test) {
      AlarmStore.saveSession(c, null)
      return
    }
    val now = System.currentTimeMillis()
    if (!s.logged) AlarmStore.appendLog(c, s, now) else AlarmStore.updateLog(c, s, dismissedAt = now)

    val cfg = AlarmStore.config(c)
    if (cfg.checkEnabled && !s.rechecked) {
      AlarmStore.saveSession(c, s.copy(logged = true))
      AlarmScheduler.scheduleCheck(c, now + cfg.checkDelayMinutes * 60_000L)
    } else {
      AlarmStore.saveSession(c, null)
    }
  }

  /**
   * Xizmat taymeri: budilnik javobsiz chalib tugadi. Imkon boʻlsa oʻzi keyinga suriladi —
   * qayta chalish (tekshiruvdan keyin) bosqichida ham, chunki maqsad uygʻotish.
   */
  fun timeout(c: Context) {
    if (canSnooze(c)) {
      snooze(c)
      return
    }
    stopRinging(c)
    val s = AlarmStore.session(c) ?: return
    if (!s.test) {
      // "Turdim" umuman bosilmagan — uygʻonmagan; bosilgan-u, qayta chalishga javob yoʻq — qayta uxlagan
      if (!s.logged) AlarmStore.appendLog(c, s, 0L) else AlarmStore.updateLog(c, s, asleep = true)
    }
    AlarmStore.saveSession(c, null)
  }

  /** Quyosh chiqdi — keyinga surilgan yoki qayta chalishlar endi kerak emas */
  fun expire(c: Context) {
    val s = AlarmStore.session(c) ?: return
    if (!s.test) {
      if (!s.logged) AlarmStore.appendLog(c, s, 0L) else if (s.rechecked) AlarmStore.updateLog(c, s, asleep = true)
    }
    AlarmStore.saveSession(c, null)
  }

  fun showCheck(c: Context) {
    val s = AlarmStore.session(c) ?: return
    if (s.endAt > 0 && System.currentTimeMillis() > s.endAt) {
      // Bomdod vaqti tugagan — soʻrashdan maʼno yoʻq, "turdi" deb qoladi
      AlarmStore.saveSession(c, null)
      return
    }
    val cfg = AlarmStore.config(c)
    ensureCheckChannel(c)

    val notification = NotificationCompat.Builder(c, CHECK_CHANNEL)
      .setSmallIcon(smallIcon(c))
      .setContentTitle("Turdingizmi?")
      .setContentText("«Ha» demasangiz, ${cfg.recheckMinutes} daqiqadan keyin budilnik yana chaladi.")
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(openApp(c))
      .addAction(0, "Ha, turdim ✓", broadcast(c, 7301, AlarmReceiver.ACTION_CONFIRM))
      .build()
    try {
      NotificationManagerCompat.from(c).notify(CHECK_NOTIF_ID, notification)
    } catch (e: SecurityException) {
      // Bildirishnoma ruxsati yoʻq — qayta chalish baribir ishlaydi
    }

    AlarmStore.saveSession(c, s.copy(rechecked = true))
    AlarmScheduler.scheduleKind(
      c,
      System.currentTimeMillis() + cfg.recheckMinutes * 60_000L,
      AlarmReceiver.KIND_RECHECK,
      AlarmScheduler.REQ_RECHECK,
    )
  }

  fun confirmAwake(c: Context) {
    AlarmScheduler.cancel(c, AlarmReceiver.ACTION_CHECK, AlarmScheduler.REQ_CHECK)
    AlarmScheduler.cancel(c, AlarmReceiver.ACTION_FIRE, AlarmScheduler.REQ_RECHECK)
    NotificationManagerCompat.from(c).cancel(CHECK_NOTIF_ID)
    val s = AlarmStore.session(c) ?: return
    // Chalayotgan budilnik faqat "Turdim" bilan oʻchadi; sinovni JS sinxronlashi oʻchirmasin
    if (s.test || AlarmService.isRinging || fallbackRinging(c)) return
    AlarmScheduler.cancel(c, AlarmReceiver.ACTION_FIRE, AlarmScheduler.REQ_SNOOZE)
    // Keyinga surilgan paytda turib, Bomdodni belgilagan — shu payt uygʻongan hisoblanadi
    if (!s.logged) AlarmStore.appendLog(c, s, System.currentTimeMillis())
    AlarmStore.saveSession(c, null)
  }

  /* ── Budilnik bildirishnomasi (xizmat va zaxira uchun bir xil) ───────────── */

  fun titleFor(s: Session?, kind: String?): String = when {
    s == null -> "Bomdod vaqti"
    kind == AlarmReceiver.KIND_RECHECK -> RECHECK_TITLE
    else -> s.title
  }

  fun bodyFor(s: Session?): String {
    if (s == null) return ""
    if (s.endAt <= 0) return s.body
    val left = ((s.endAt - System.currentTimeMillis()) / 60_000L).toInt()
    return if (left > 0) "Quyosh chiqishiga $left daqiqa qoldi" else s.body
  }

  fun screenIntent(c: Context, kind: String): Intent =
    Intent(c, AlarmActivity::class.java)
      .putExtra(AlarmReceiver.EXTRA_KIND, kind)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)

  fun alarmNotification(c: Context, channel: String, kind: String): NotificationCompat.Builder {
    val s = AlarmStore.session(c)
    val cfg = AlarmStore.config(c)
    val screen = PendingIntent.getActivity(c, 7401, screenIntent(c, kind), FLAGS)
    val builder = NotificationCompat.Builder(c, channel)
      .setSmallIcon(smallIcon(c))
      .setContentTitle(titleFor(s, kind))
      .setContentText(bodyFor(s))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(screen)
      .setFullScreenIntent(screen, true)

    // Misol rejimida bildirishnomadan oʻchirib boʻlmaydi — oynani ochib, misolni yechish kerak
    if (!cfg.challenge || s?.test == true) {
      builder.addAction(0, "Turdim", broadcast(c, 7402, AlarmReceiver.ACTION_DISMISS))
    }
    if (canSnooze(c)) {
      builder.addAction(0, "${cfg.snoozeMinutes} daqiqadan keyin", broadcast(c, 7403, AlarmReceiver.ACTION_SNOOZE))
    }
    return builder
  }

  /**
   * Zaxira yoʻl: oldingi plan xizmatisiz. Ovozni tizim chaladi (budilnik ohangi, toʻxtovsiz
   * takrorlanadi — FLAG_INSISTENT), oyna full-screen intent bilan ochiladi.
   */
  fun startFallback(c: Context, kind: String) {
    if (AlarmStore.session(c) == null) return
    ensureFallbackChannel(c)
    val notification = alarmNotification(c, FALLBACK_CHANNEL, kind)
      .setTimeoutAfter(15 * 60_000L)
      .build()
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    try {
      NotificationManagerCompat.from(c).notify(FALLBACK_NOTIF_ID, notification)
    } catch (e: SecurityException) {
      // Bildirishnoma ruxsati ham yoʻq — qiladigan narsa qolmadi
    }
  }

  /** Zaxira bildirishnomasi hozir chalyaptimi (jarayon qayta tugʻilgan boʻlsa ham bilinadi) */
  fun fallbackRinging(c: Context): Boolean {
    val nm = c.getSystemService(NotificationManager::class.java) ?: return false
    return try {
      nm.activeNotifications.any { it.id == FALLBACK_NOTIF_ID }
    } catch (e: Exception) {
      false
    }
  }

  /* ── Yordamchilar ────────────────────────────────────────────────────────── */

  private fun broadcast(c: Context, req: Int, action: String): PendingIntent =
    PendingIntent.getBroadcast(c, req, Intent(c, AlarmReceiver::class.java).setAction(action), FLAGS)

  fun smallIcon(c: Context): Int {
    // expo-notifications plagini yaratgan oq ikonka; topilmasa — tizimdagi budilnik belgisi
    val id = c.resources.getIdentifier("notification_icon", "drawable", c.packageName)
    return if (id != 0) id else android.R.drawable.ic_lock_idle_alarm
  }

  fun openApp(c: Context): PendingIntent? {
    val launch = c.packageManager.getLaunchIntentForPackage(c.packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(c, 7302, launch, FLAGS)
  }

  private fun ensureCheckChannel(c: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = c.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHECK_CHANNEL) != null) return
    val ch = NotificationChannel(CHECK_CHANNEL, "Uygʻonish tekshiruvi", NotificationManager.IMPORTANCE_HIGH)
    ch.description = "Budilnikdan keyin «Turdingizmi?» soʻrovi"
    ch.enableVibration(true)
    nm.createNotificationChannel(ch)
  }

  private fun ensureFallbackChannel(c: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = c.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(FALLBACK_CHANNEL) != null) return
    val ch = NotificationChannel(FALLBACK_CHANNEL, "Bomdod budilnigi (zaxira)", NotificationManager.IMPORTANCE_HIGH)
    ch.description = "Android xizmatni ishga tushirmasa — budilnik shu bildirishnoma ovozi bilan chaladi"
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), attrs)
    ch.enableVibration(true)
    ch.vibrationPattern = longArrayOf(0, 700, 500)
    ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    ch.setBypassDnd(true)
    nm.createNotificationChannel(ch)
  }
}
