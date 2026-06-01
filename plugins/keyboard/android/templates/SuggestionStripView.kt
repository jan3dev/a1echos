package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Color
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Up-to-3 tappable word candidates shown in place of the top bar's logo +
 * record chrome while the user composes a word (§5.5). Tapping a candidate asks
 * the listener to replace the in-progress word. Mirrors the iOS
 * `SuggestionStripView` so both platforms read as the same product.
 */
class SuggestionStripView(context: Context) : LinearLayout(context) {

    fun interface Listener {
        fun onCandidateTapped(word: String)
    }

    private var listener: Listener? = null
    private val theme = KeyTheme(context)

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    /** Replaces the strip's contents. The caller hides the strip for an empty
     *  list — this only populates it. */
    fun setCandidates(candidates: List<String>) {
        removeAllViews()
        candidates.take(3).forEachIndexed { idx, candidate ->
            if (idx > 0) addView(makeDivider())
            addView(makeButton(candidate))
        }
    }

    private fun makeButton(word: String): TextView {
        return TextView(context).apply {
            text = word
            setTextColor(theme.keyText)
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            isClickable = true
            isFocusable = true
            contentDescription = word
            // Equal-width slots; the 1dp dividers keep their fixed width.
            layoutParams = LayoutParams(0, LayoutParams.MATCH_PARENT, 1f)
            val ripple = TypedValue()
            context.theme.resolveAttribute(
                android.R.attr.selectableItemBackground, ripple, true,
            )
            setBackgroundResource(ripple.resourceId)
            setOnClickListener { listener?.onCandidateTapped(word) }
        }
    }

    private fun makeDivider(): View {
        val widthPx = (1 * resources.displayMetrics.density).toInt()
        val verticalMargin = (8 * resources.displayMetrics.density).toInt()
        return View(context).apply {
            layoutParams = LayoutParams(widthPx, LayoutParams.MATCH_PARENT).apply {
                topMargin = verticalMargin
                bottomMargin = verticalMargin
            }
            setBackgroundColor(
                Color.argb(
                    0x26,
                    Color.red(theme.keyText),
                    Color.green(theme.keyText),
                    Color.blue(theme.keyText),
                ),
            )
        }
    }
}
