package expo.modules.bomdodalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
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
import androidx.core.app.ServiceCompat

/**
 * Budilnik chalayotgan paytdagi oldingi plan xizmati.
 *   · ovoz — telefonning budilnik ohangi, BUDILNIK oqimida (ovozsiz rejimda ham eshitiladi),
 *     takrorlanadi va 15 soniyada asta balandlashadi; oqim juda past boʻlsa ~70% ga koʻtariladi
 *   · tebranish — takrorlanuvchi
 *   · bildirishnoma — full-screen intent bilan: ekran oʻchiq/qulf boʻlsa oyna ochiladi,
 *     telefon ishlatilayotgan boʻlsa tepada tugmalar bilan chiqadi
 *   · N daqiqa javob boʻlmasa — oʻzi keyinga suriladi (AlarmControl.timeout)
 */
class AlarmService : Service() {
  companion object {
    private const val CHANNEL = "bomdod_budilnik"
    const val NOTIF_ID = 7201

    @Volatile
    var isRinging = false
      private set
  }

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private var volume = 0.2f
  private var savedAlarmVolume = -1
  private val timeoutTask = Runnable { AlarmControl.timeout(this) }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val kind = intent?.getStringExtra(AlarmReceiver.EXTRA_KIND) ?: AlarmReceiver.KIND_MAIN
    ensureChannel()

    // startForegroundService() bilan ochilgan xizmat startForeground()ni ALBATTA chaqirishi
    // kerak — undan oldin stopSelf() qilinsa ham Android ilovani yiqitadi. Shuning uchun birinchi.
    try {
      ServiceCompat.startForeground(
        this,
        NOTIF_ID,
        AlarmControl.alarmNotification(this, CHANNEL, kind).build(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
      )
    } catch (e: Exception) {
      // Android oldingi plan xizmatiga ruxsat bermadi — zaxira yoʻl
      AlarmControl.startFallback(this, kind)
      stopSelf()
      return START_NOT_STICKY
    }

    if (AlarmStore.session(this) == null) {
      // Shu orada budilnik bekor qilingan (masalan, Bomdod "oʻqildi" deb belgilandi)
      stopSelf()
      return START_NOT_STICKY
    }
    isRinging = true

    // Avval eski taymerlar (oldingi chalinishdan) tozalanadi — keyin ovoz balandlash taymeri
    // qoʻyiladi. Teskari tartibda ovoz 20% da qotib qolardi.
    handler.removeCallbacksAndMessages(null)
    acquireWakeLock()
    raiseAlarmVolume()
    startSound()
    startVibration()
    launchActivity(kind)
    handler.postDelayed(timeoutTask, AlarmStore.config(this).ringMinutes * 60_000L)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    isRinging = false
    handler.removeCallbacksAndMessages(null)
    stopSound()
    stopVibration()
    restoreAlarmVolume()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
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

  private fun launchActivity(kind: String) {
    // Full-screen intent asosiy yoʻl; bu — ekran yoniq boʻlgan holat uchun qoʻshimcha urinish
    try {
      startActivity(AlarmControl.screenIntent(this, kind))
    } catch (e: Exception) {
      // Android fon cheklovi — bildirishnoma baribir chiqadi
    }
  }

  /* ── Ovoz ────────────────────────────────────────────────────────────────── */

  private fun audioManager(): AudioManager? = getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  /** Budilnik ovozi juda past qoʻyilgan boʻlsa — chalish paytida kamida ~70% ga koʻtaramiz */
  private fun raiseAlarmVolume() {
    val am = audioManager() ?: return
    try {
      val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      val current = am.getStreamVolume(AudioManager.STREAM_ALARM)
      val floor = (max * 7 + 9) / 10
      if (current < floor) {
        if (savedAlarmVolume < 0) savedAlarmVolume = current
        am.setStreamVolume(AudioManager.STREAM_ALARM, floor, 0)
      }
    } catch (e: Exception) {
      // Ayrim rejimlarda tizim ruxsat bermaydi — mavjud balandlikda chaladi
    }
  }

  /** Foydalanuvchining oʻz sozlamasi qaytariladi */
  private fun restoreAlarmVolume() {
    if (savedAlarmVolume < 0) return
    try {
      audioManager()?.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0)
    } catch (e: Exception) {
      // ixtiyoriy
    }
    savedAlarmVolume = -1
  }

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
    volume = 0.2f
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
