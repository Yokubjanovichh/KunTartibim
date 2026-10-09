package expo.modules.bomdodalarm

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

/**
 * Qulf ekrani ustidagi budilnik oynasi. Dizayn ilova bilan bir xil:
 * qora fon, oq matn, bitta oltin urgʻu. Orqaga tugmasi bilan yopilmaydi —
 * faqat "Turdim" yoki "N daqiqadan keyin".
 */
class AlarmActivity : Activity() {
  companion object {
    private var current: WeakReference<AlarmActivity>? = null

    fun finishCurrent() {
      current?.get()?.let { if (!it.isFinishing) it.finish() }
      current = null
    }

    // Ilova tokenlari bilan bir xil (src/theme/tokens.ts)
    private val BG = Color.parseColor("#0A0A0A")
    private val TEXT = Color.parseColor("#FAFAFA")
    private val MUTED = Color.parseColor("#8E8E8E")
    private val ACCENT = Color.parseColor("#E8A33D")
    private val SURFACE = Color.parseColor("#1A1A1A")
    private val DANGER = Color.parseColor("#FF4D2E")
  }

  private var answer = 0
  private var hint: TextView? = null
  private var question: TextView? = null
  private var options: List<Button> = emptyList()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    current = WeakReference(this)
    showOverLockScreen()
    setContentView(buildUi())
    blockBack()
  }

  override fun onResume() {
    super.onResume()
    // Budilnik boshqa joydan (bildirishnoma tugmasi) oʻchirilgan boʻlsa — oyna kerak emas
    if (!AlarmService.isRinging) finish()
  }

  override fun onDestroy() {
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  @Deprecated("Deprecated in Java")
  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    // ataylab boʻsh: yarim uyquda orqaga bosib oʻchirib qoʻymaslik uchun
  }

  private fun blockBack() {
    if (Build.VERSION.SDK_INT >= 33) {
      onBackInvokedDispatcher.registerOnBackInvokedCallback(
        android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
      ) { }
    }
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  /* ── Koʻrinish ───────────────────────────────────────────────────────────── */

  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

  private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false): TextView =
    TextView(this).apply {
      text = value
      textSize = sizeSp
      setTextColor(color)
      gravity = Gravity.CENTER
      typeface = if (bold) Typeface.create("sans-serif-medium", Typeface.NORMAL) else Typeface.create("sans-serif-light", Typeface.NORMAL)
    }

  private fun button(label: String, bg: Int, fg: Int, onClick: () -> Unit): Button =
    Button(this).apply {
      text = label
      isAllCaps = false
      textSize = 18f
      setTextColor(fg)
      background = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        setColor(bg)
      }
      setOnClickListener { onClick() }
    }

  private fun full(height: Int, top: Int): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(height)).apply { topMargin = dp(top) }

  private fun buildUi(): View {
    val session = AlarmStore.session(this)
    val cfg = AlarmStore.config(this)
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(BG)
      setPadding(dp(32), dp(48), dp(32), dp(48))
    }

    root.addView(text(SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()), 76f, TEXT))
    root.addView(text(session?.title ?: "Bomdod vaqti", 24f, ACCENT, bold = true))

    val left = session?.endAt?.let { ((it - System.currentTimeMillis()) / 60_000L).toInt() } ?: 0
    val body = if (left > 0) "Quyosh chiqishiga $left daqiqa qoldi" else (session?.body ?: "")
    root.addView(text(body, 16f, MUTED).apply { setPadding(0, dp(8), 0, 0) })

    val spacer = View(this)
    root.addView(spacer, LinearLayout.LayoutParams(1, dp(56)))

    if (cfg.challenge && session?.test != true) {
      addChallenge(root)
    } else {
      root.addView(button("Turdim", ACCENT, BG) { AlarmControl.dismiss(this) }, full(64, 0))
    }

    if (AlarmControl.canSnooze(this)) {
      root.addView(
        button("${cfg.snoozeMinutes} daqiqadan keyin", SURFACE, TEXT) { AlarmControl.snooze(this) },
        full(56, 12),
      )
    }
    return root
  }

  /* ── Misol: yarim uyquda oʻchirib qoʻymaslik uchun ───────────────────────── */

  private fun addChallenge(root: LinearLayout) {
    question = text("", 34f, TEXT, bold = true)
    root.addView(question)
    hint = text("Toʻgʻri javobni bosing — budilnik oʻchadi", 14f, MUTED).apply { setPadding(0, dp(6), 0, dp(16)) }
    root.addView(hint)

    val row1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    val row2 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    val buttons = (0 until 4).map { i ->
      button("", SURFACE, TEXT) { onAnswer(i) }.also { b ->
        val lp = LinearLayout.LayoutParams(0, dp(60), 1f).apply {
          setMargins(dp(6), dp(6), dp(6), dp(6))
        }
        (if (i < 2) row1 else row2).addView(b, lp)
      }
    }
    options = buttons
    root.addView(row1, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    root.addView(row2, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    newQuestion()
  }

  private fun newQuestion() {
    val a = Random.nextInt(12, 60)
    val b = Random.nextInt(12, 40)
    answer = a + b
    question?.text = "$a + $b = ?"
    val values = mutableSetOf(answer)
    while (values.size < 4) {
      val delta = Random.nextInt(1, 12) * (if (Random.nextBoolean()) 1 else -1)
      values.add(answer + delta)
    }
    val shuffled = values.shuffled()
    options.forEachIndexed { i, btn ->
      btn.text = shuffled[i].toString()
      btn.tag = shuffled[i]
    }
  }

  private fun onAnswer(index: Int) {
    val value = options.getOrNull(index)?.tag as? Int ?: return
    if (value == answer) {
      AlarmControl.dismiss(this)
    } else {
      hint?.setTextColor(DANGER)
      hint?.text = "Notoʻgʻri — yangi misol"
      newQuestion()
    }
  }
}
