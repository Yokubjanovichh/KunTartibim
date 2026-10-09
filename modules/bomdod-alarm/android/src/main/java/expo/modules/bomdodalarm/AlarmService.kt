package expo.modules.bomdodalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Budilnik chalayotgan paytdagi oldingi plan xizmati.
 *   · ovoz — telefonning budilnik ohangi, BUDILNIK oqimida (ovozsiz rejimda ham eshitiladi),
 *     takrorlanadi va 15 soniyada asta balandlashadi
 *   · tebranish — takrorlanuvchi
 *   · bildirishnoma — full-screen intent bilan: ekran oʻchiq/qulf boʻlsa oyna ochiladi,
 *     telefon ishlatilayotgan boʻlsa tepada tugmalar bilan chiqadi
 *   · N daqiqa javob boʻlmasa — oʻzi keyinga suriladi (AlarmControl.timeout)
 */
class AlarmService : Service() {
  companion object {
    private const val CHANNEL = "bomdod_budilnik"
    const val NOTIF_ID = 7201
    private const val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    @Volatile
    var isRinging = false
      private set
  }

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private var volume = 0.2f

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val session = AlarmStore.session(this)
    if (session == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    val kind = intent?.getStringExtra(AlarmReceiver.EXTRA_KIND) ?: AlarmReceiver.KIND_MAIN
    val title = if (kind == AlarmReceiver.KIND_RECHECK) "Hali turmadingizmi?" else session.title

    ensureChannel()
    ServiceCompat.startForeground(
      this,
      NOTIF_ID,
      buildNotification(title, bodyFor(session)),
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
    )
    isRinging = true

    acquireWakeLock()
    startSound()
    startVibration()
    launchActivity()

    handler.removeCallbacksAndMessages(null)
    handler.postDelayed({ AlarmControl.timeout(this) }, AlarmStore.config(this).ringMinutes * 60_000L)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    isRinging = false
    handler.removeCallbacksAndMessages(null)
    stopSound()
    stopVibration()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  /* ── Bildirishnoma ───────────────────────────────────────────────────────── */

  private fun activityIntent(): Intent =
    Intent(this, AlarmActivity::class.java).addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION,
    )

  private fun buildNotification(title: String, body: String): Notification {
    val full = PendingIntent.getActivity(this, 7401, activityIntent(), FLAGS)
    val builder = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(AlarmControl.smallIcon(this))
      .setContentTitle(title)
      .setContentText(body)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(full)
      .setFullScreenIntent(full, true)

    // Misol rejimida bildirishnomadan oʻchirib boʻlmaydi — oynani ochib, misolni yechish kerak
    if (!AlarmStore.config(this).challenge) {
      val dismiss = PendingIntent.getBroadcast(
        this,
        7402,
        Intent(this, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_DISMISS),
        FLAGS,
      )
      builder.addAction(0, "Turdim", dismiss)
    }
    if (AlarmControl.canSnooze(this)) {
      val snooze = PendingIntent.getBroadcast(
        this,
        7403,
        Intent(this, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_SNOOZE),
        FLAGS,
      )
      builder.addAction(0, "${AlarmStore.config(this).snoozeMinutes} daqiqadan keyin", snooze)
    }
    return builder.build()
  }

  private fun bodyFor(s: Session): String {
    if (s.endAt <= 0) return s.body
    val left = ((s.endAt - System.currentTimeMillis()) / 60_000L).toInt()
    return if (left > 0) "Quyosh chiqishiga $left daqiqa qoldi" else s.body
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL) != null) return
    val ch = NotificationChannel(CHANNEL, "Bomdod budilnigi", NotificationManager.IMPORTANCE_HIGH)
    ch.description = "Uygʻotuvchi budilnik — ovozni ilovaning oʻzi chaladi"
    ch.setSound(null, null)
    ch.enableVibration(false)
    ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    ch.setBypassDnd(true)
    nm.createNotificationChannel(ch)
  }

  private fun launchActivity() {
    // Full-screen intent asosiy yoʻl; bu — ekran yoniq boʻlgan holat uchun qoʻshimcha urinish
    try {
      startActivity(activityIntent())
    } catch (e: Exception) {
      // Android fon cheklovi — bildirishnoma baribir chiqadi
    }
  }

  /* ── Ovoz ────────────────────────────────────────────────────────────────── */

  private fun candidateUris(): List<Uri> {
    val list = mutableListOf<Uri>()
    RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)?.let { list.add(it) }
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)?.let { list.add(it) }
    list.add(Settings.System.DEFAULT_ALARM_ALERT_URI)
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)?.let { list.add(it) }
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)?.let { list.add(it) }
    return list
  }

  private fun startSound() {
    stopSound()
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    for (uri in candidateUris()) {
      val mp = MediaPlayer()
      try {
        mp.setAudioAttributes(attrs)
        mp.setDataSource(this, uri)
        mp.isLooping = true
        mp.setVolume(volume, volume)
        mp.prepare()
        mp.start()
        player = mp
        rampVolume()
        return
      } catch (e: Exception) {
        // Bu ohang ochilmadi (masalan, xotiradagi fayl) — keyingisini sinaymiz
        mp.release()
      }
    }
  }

  private fun rampVolume() {
    handler.postDelayed(object : Runnable {
      override fun run() {
        val mp = player ?: return
        volume = (volume + 0.08f).coerceAtMost(1f)
        try {
          mp.setVolume(volume, volume)
        } catch (e: Exception) {
          return
        }
        if (volume < 1f) handler.postDelayed(this, 1_500L)
      }
    }, 1_500L)
  }

  private fun stopSound() {
    player?.let {
      try {
        if (it.isPlaying) it.stop()
      } catch (e: Exception) {
        // allaqachon toʻxtagan
      }
      it.release()
    }
    player = null
  }

  /* ── Tebranish ───────────────────────────────────────────────────────────── */

  @Suppress("DEPRECATION")
  private fun systemVibrator(): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

  @Suppress("DEPRECATION")
  private fun startVibration() {
    val v = systemVibrator() ?: return
    vibrator = v
    val pattern = longArrayOf(0, 700, 500)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        v.vibrate(VibrationEffect.createWaveform(pattern, 0))
      } else {
        v.vibrate(pattern, 0)
      }
    } catch (e: Exception) {
      // tebranish ixtiyoriy
    }
  }

  private fun stopVibration() {
    try {
      vibrator?.cancel()
    } catch (e: Exception) {
      // ixtiyoriy
    }
    vibrator = null
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "KunTartibim:BomdodAlarm").apply {
      acquire(20 * 60_000L)
    }
  }
}
