package expo.modules.bomdodalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Tizimdan keladigan barcha budilnik hodisalari:
 *   FIRE    — chalish vaqti (asosiy, keyinga surilgan, qayta tekshiruv, sinov)
 *   CHECK   — "Turdingizmi?" soʻrovi
 *   CONFIRM — "Ha, turdim" (tekshiruvni bekor qiladi)
 *   DISMISS / SNOOZE — bildirishnomadagi tugmalar
 */
class AlarmReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_FIRE = "uz.kuntartibim.alarm.FIRE"
    const val ACTION_CHECK = "uz.kuntartibim.alarm.CHECK"
    const val ACTION_CONFIRM = "uz.kuntartibim.alarm.CONFIRM"
    const val ACTION_DISMISS = "uz.kuntartibim.alarm.DISMISS"
    const val ACTION_SNOOZE = "uz.kuntartibim.alarm.SNOOZE"

    const val EXTRA_KIND = "kind"
    const val EXTRA_AT = "at"

    const val KIND_MAIN = "main"
    const val KIND_SNOOZE = "snooze"
    const val KIND_RECHECK = "recheck"
    const val KIND_TEST = "test"
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_FIRE -> onFire(context, intent)
      ACTION_CHECK -> AlarmControl.showCheck(context)
      ACTION_CONFIRM -> AlarmControl.confirmAwake(context)
      ACTION_DISMISS -> AlarmControl.dismiss(context)
      ACTION_SNOOZE -> AlarmControl.snooze(context)
    }
  }

  private fun onFire(context: Context, intent: Intent) {
    val kind = intent.getStringExtra(EXTRA_KIND) ?: KIND_MAIN
    val now = System.currentTimeMillis()

    if (kind == KIND_MAIN) {
      val at = intent.getLongExtra(EXTRA_AT, now)
      val items = AlarmStore.schedule(context)
      val item = items.firstOrNull { it.at == at } ?: items.filter { it.at <= now + 60_000 }.maxByOrNull { it.at }
      // Zanjir: chalingani olib tashlab, darhol keyingi kunnikini qoʻyamiz
      AlarmStore.dropThrough(context, maxOf(at, now))
      AlarmScheduler.scheduleNext(context)
      if (item == null) return
      // Telefon oʻchiq turib, Bomdod vaqti chiqib ketgan boʻlsa — chalishdan maʼno yoʻq
      if (item.endAt > 0 && now > item.endAt) return
      AlarmStore.saveSession(context, Session(item.at, item.endAt, item.title, item.body, firedAt = now))
    } else if (AlarmStore.session(context) == null) {
      return
    }

    AlarmControl.startRinging(context, kind)
  }
}

/** Telefon qayta yonganda, vaqt yoki ilova yangilanganda — keyingi budilnikni tiklash */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.scheduleNext(context)
  }
}
