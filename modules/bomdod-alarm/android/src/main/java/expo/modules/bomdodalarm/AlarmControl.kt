package expo.modules.bomdodalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Budilnik mantigʻi — oyna, bildirishnoma tugmalari va xizmat taymeri bir xil
 * yoʻldan oʻtadi:
 *   dismiss  — "Turdim": ovoz toʻxtaydi, jurnalga yoziladi, N daqiqadan keyin tekshiruv
 *   snooze   — "N daqiqa": cheklangan marta
 *   showCheck → "Turdingizmi?"; javob boʻlmasa recheck — budilnik qayta chaladi
 *   confirmAwake — "Ha, turdim" yoki Bomdod "oʻqildi" deb belgilanganda (JS'dan)
 */
internal object AlarmControl {
  private const val CHECK_CHANNEL = "bomdod_tekshiruv"
  const val CHECK_NOTIF_ID = 7202
  private const val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  fun startRinging(c: Context, kind: String) {
    val intent = Intent(c, AlarmService::class.java).putExtra(AlarmReceiver.EXTRA_KIND, kind)
    ContextCompat.startForegroundService(c, intent)
  }

  private fun stopRinging(c: Context) {
    c.stopService(Intent(c, AlarmService::class.java))
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
    if (!s.logged) AlarmStore.appendLog(c, s, now) else if (s.rechecked) AlarmStore.markLastRechecked(c, s.at, now)

    val cfg = AlarmStore.config(c)
    if (cfg.checkEnabled && !s.rechecked) {
      AlarmStore.saveSession(c, s.copy(logged = true))
      AlarmScheduler.scheduleCheck(c, now + cfg.checkDelayMinutes * 60_000L)
    } else {
      AlarmStore.saveSession(c, null)
    }
  }

  /** Xizmat taymeri: budilnik javobsiz chalib tugadi */
  fun timeout(c: Context) {
    if (canSnooze(c)) {
      snooze(c)
      return
    }
    stopRinging(c)
    val s = AlarmStore.session(c) ?: return
    if (!s.test && !s.logged) AlarmStore.appendLog(c, s, 0L)
    AlarmStore.saveSession(c, null)
  }

  fun showCheck(c: Context) {
    val s = AlarmStore.session(c) ?: return
    val cfg = AlarmStore.config(c)
    ensureCheckChannel(c)

    val confirm = PendingIntent.getBroadcast(
      c,
      7301,
      Intent(c, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_CONFIRM),
      FLAGS,
    )
    val notification = NotificationCompat.Builder(c, CHECK_CHANNEL)
      .setSmallIcon(smallIcon(c))
      .setContentTitle("Turdingizmi?")
      .setContentText("«Ha» demasangiz, ${cfg.recheckMinutes} daqiqadan keyin budilnik yana chaladi.")
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(openApp(c))
      .addAction(0, "Ha, turdim ✓", confirm)
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
    if (!AlarmService.isRinging) AlarmStore.saveSession(c, null)
  }

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
}
