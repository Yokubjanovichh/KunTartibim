package expo.modules.bomdodalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Budilnikni tizimga qoʻyish. `setAlarmClock` — soat ilovalari ishlatadigan yoʻl:
 * Doze rejimidan ozod, aniq vaqtda ishlaydi, holat qatorida budilnik belgisi chiqadi.
 * Huawei batareya tejagichi ham uni oddiy fon ishlaridan koʻra koʻproq hurmat qiladi.
 */
internal object AlarmScheduler {
  const val REQ_MAIN = 7101
  const val REQ_SNOOZE = 7102
  const val REQ_CHECK = 7103
  const val REQ_RECHECK = 7104
  const val REQ_TEST = 7105
  private const val REQ_SHOW = 7199

  private fun alarmManager(c: Context) = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private const val FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  fun canScheduleExact(c: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(c).canScheduleExactAlarms()

  private fun receiver(c: Context, action: String, req: Int, kind: String? = null, at: Long? = null): PendingIntent {
    val intent = Intent(c, AlarmReceiver::class.java).setAction(action)
    if (kind != null) intent.putExtra(AlarmReceiver.EXTRA_KIND, kind)
    if (at != null) intent.putExtra(AlarmReceiver.EXTRA_AT, at)
    return PendingIntent.getBroadcast(c, req, intent, FLAGS)
  }

  /** Holat qatoridagi budilnik belgisini bosganda ochiladigan oyna — ilovaning oʻzi */
  private fun showIntent(c: Context): PendingIntent {
    val launch = c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent(c, AlarmActivity::class.java)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(c, REQ_SHOW, launch, FLAGS)
  }

  private fun setAt(c: Context, at: Long, operation: PendingIntent) {
    val am = alarmManager(c)
    try {
      if (canScheduleExact(c)) {
        am.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent(c)), operation)
      } else {
        // Ruxsat olib qoʻyilgan boʻlsa — hech boʻlmasa taxminiy (Doze'da ham ishlaydigan)
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation)
      }
    } catch (e: SecurityException) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation)
    }
  }

  /** Jadvaldagi eng yaqin kelajakdagi budilnikni qoʻyadi (yoki yoʻq boʻlsa bekor qiladi) */
  fun scheduleNext(c: Context) {
    val now = System.currentTimeMillis()
    val next = AlarmStore.schedule(c).firstOrNull { it.at > now + 1000 }
    if (next == null) {
      alarmManager(c).cancel(receiver(c, AlarmReceiver.ACTION_FIRE, REQ_MAIN))
      return
    }
    setAt(c, next.at, receiver(c, AlarmReceiver.ACTION_FIRE, REQ_MAIN, AlarmReceiver.KIND_MAIN, next.at))
  }

  fun scheduleKind(c: Context, at: Long, kind: String, req: Int) {
    setAt(c, at, receiver(c, AlarmReceiver.ACTION_FIRE, req, kind))
  }

  fun scheduleCheck(c: Context, at: Long) {
    setAt(c, at, receiver(c, AlarmReceiver.ACTION_CHECK, REQ_CHECK))
  }

  /** PendingIntent action + requestCode boʻyicha solishtiriladi — extras ahamiyatsiz */
  fun cancel(c: Context, action: String, req: Int) {
    alarmManager(c).cancel(receiver(c, action, req))
  }

  fun nextMain(c: Context): Long? =
    AlarmStore.schedule(c).firstOrNull { it.at > System.currentTimeMillis() }?.at
}
