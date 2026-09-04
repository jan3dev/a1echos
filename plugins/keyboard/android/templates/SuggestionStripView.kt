package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/**
 * One strip slot. Mirrors the native QuickType layout: while a correction is
 * pending the left slot shows the typed word in quotes (tap = keep it and
 * learn it), the emphasized center slot shows the correction that autocorrect
 * will apply, and the right slot a runner-up.
 */
data class SuggestionSlot(
    /** The raw text tapping this slot commits (never quoted). */
    val text: String,
    /** True for the quoted "keep what I typed" slot. */
    val isVerbatim: Boolean,
    /** Bold — marks the word autocorrect is about to apply. */
    val isEmphasized: Boolean,
) {
    companion object {
        fun candidate(text: String) = SuggestionSlot(text, isVerbatim = false, isEmphasized = false)
    }
}

/**
 * Up-to-3 tappable word candidates shown left of the top bar's record
 * button while the user composes a word (§5.5). Tapping a candidate
 * asks the listener to replace the in-progress word (or keep it, for the
 * verbatim slot). Mirrors the iOS `SuggestionStripView` so both platforms
 * read as the same product.
 */
class SuggestionStripView(context: Context) : LinearLayout(context) {

    fun interface Listener {
        fun onSlotTapped(slot: SuggestionSlot)
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
    fun setSlots(slots: List<SuggestionSlot>) {
        removeAllViews()
        slots.take(3).forEachIndexed { idx, slot ->
            if (idx > 0) addView(makeDivider())
            addView(makeButton(slot))
        }
    }

    private fun makeButton(slot: SuggestionSlot): TextView {
        return TextView(context).apply {
            text = if (slot.isVerbatim) "“${slot.text}”" else slot.text
            setTextColor(theme.keyText)
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTypeface(null, if (slot.isEmphasized) Typeface.BOLD else Typeface.NORMAL)
            isClickable = true
            isFocusable = true
            contentDescription = if (slot.isVerbatim) "Keep ${slot.text}" else slot.text
            // Equal-width slots; the 1dp dividers keep their fixed width.
            layoutParams = LayoutParams(0, LayoutParams.MATCH_PARENT, 1f)
            if (slot.isEmphasized) {
                // Native-style highlight on the word autocorrect is about to
                // apply.
                background = GradientDrawable().apply {
                    cornerRadius = 8 * resources.displayMetrics.density
                    setColor(
                        Color.argb(
                            0x14,
                            Color.red(theme.keyText),
                            Color.green(theme.keyText),
                            Color.blue(theme.keyText),
                        ),
                    )
                }
            } else {
                val ripple = TypedValue()
                context.theme.resolveAttribute(
                    android.R.attr.selectableItemBackground, ripple, true,
                )
                setBackgroundResource(ripple.resourceId)
            }
            setOnClickListener {
                KeyFeedback.keyPress(this)
                listener?.onSlotTapped(slot)
            }
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
