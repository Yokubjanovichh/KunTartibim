package expo.modules.bomdodalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AlarmItemRecord : Record {
  @Field
  val at: Double = 0.0

  @Field
  val endAt: Double = 0.0

  @Field
  val title: String = "Bomdod vaqti"

  @Field
  val body: String = ""
}

class AlarmConfigRecord : Record {
  @Field
  val snoozeMinutes: Int = 5

  @Field
  val maxSnoozes: Int = 2

  @Field
  val checkEnabled: Boolean = true

  @Field
  val checkDelayMinutes: Int = 15

  @Field
  val recheckMinutes: Int = 3

  @Field
  val challenge: Boolean = false

  @Field
  val ringMinutes: Int = 5
}

/**
 * JS tomoni: Bomdod vaqtlarini (adhan bilan) hisoblab, keyingi ~14 kunlik
 * budilniklar roʻyxatini beradi. Native tomoni uni saqlaydi va har chalinishdan
 * keyin keyingisini oʻzi qoʻyadi — ilova 2 hafta ochilmasa ham ishlayveradi.
 */
class BomdodAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BomdodAlarm")

    Function("setSchedule") { alarms: List<AlarmItemRecord>, config: AlarmConfigRecord ->
      AlarmStore.saveConfig(
        context,
        AlarmConfig(
          snoozeMinutes = config.snoozeMinutes,
          maxSnoozes = config.maxSnoozes,
          checkEnabled = config.checkEnabled,
          checkDelayMinutes = config.checkDelayMinutes,
          recheckMinutes = config.recheckMinutes,
          challenge = config.challenge,
          ringMinutes = config.ringMinutes,
        ),
      )
      AlarmStore.saveSchedule(
        context,
        alarms.map { AlarmItem(it.at.toLong(), it.endAt.toLong(), it.title, it.body) },
      )
      AlarmScheduler.scheduleNext(context)
    }

    Function("clear") {
      AlarmStore.saveSchedule(context, emptyList())
      AlarmScheduler.scheduleNext(context)
    }

    /** Sinov: N soniyadan keyin xuddi Bomdoddagidek chaladi (tekshiruvsiz, keyinga surishsiz) */
    Function("testIn") { seconds: Int ->
      val at = System.currentTimeMillis() + seconds * 1000L
      AlarmStore.saveSession(
        context,
        Session(
          at = at,
          endAt = 0L,
          title = "Sinov budilnigi",
          body = "Bomdodda shunday chaladi. «Turdim»ni bosing.",
          firedAt = at,
          test = true,
        ),
      )
      AlarmScheduler.scheduleKind(context, at, AlarmReceiver.KIND_TEST, AlarmScheduler.REQ_TEST)
    }

    Function("confirmAwake") {
      AlarmControl.confirmAwake(context)
    }

    Function("getLog") {
      AlarmStore.log(context)
    }

    Function("status") {
      val canFullScreen = if (Build.VERSION.SDK_INT >= 34) {
        context.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() ?: true
      } else {
        true
      }
      mapOf(
        "next" to AlarmScheduler.nextMain(context)?.toDouble(),
        "canScheduleExact" to AlarmScheduler.canScheduleExact(context),
        "canFullScreen" to canFullScreen,
        "ringing" to AlarmService.isRinging,
      )
    }

    /** Android 14+: "Toʻliq ekranli bildirishnomalar" ruxsati sahifasi */
    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        try {
          context.startActivity(
            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
          )
          true
        } catch (e: Exception) {
          false
        }
      } else {
        false
      }
    }
  }
}
