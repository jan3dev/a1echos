package com.a1lab.echos.ime

import android.animation.ObjectAnimator
import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

class EchosEmojiSearchOverlayView(context: Context) : LinearLayout(context) {

    interface Listener {
        fun onClearQuery()
        fun onEmojiSelected(emoji: String)
    }

    private val theme = KeyTheme(context)
    private var listener: Listener? = null

    private val queryLabel: TextView
    private val placeholder: TextView
    private val cursorView: View
    private val clearButton: TextView
    private val resultsScroll: HorizontalScrollView
    private val resultsRow: LinearLayout
    private val cursorAnimator: ObjectAnimator

    init {
        orientation = VERTICAL
        setBackgroundColor(theme.keyboardBackground)
        val padH = dpPx(8f).toInt()
        setPadding(padH, dpPx(6f).toInt(), padH, dpPx(6f).toInt())

        val pillContainer = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = dpPx(9f)
                setColor(theme.specialKeyBackground)
            }
            val ph = dpPx(10f).toInt()
            setPadding(ph, 0, ph, 0)
            val lp = LayoutParams(LayoutParams.MATCH_PARENT, dpPx(32f).toInt())
            layoutParams = lp
        }

        val magnifier = TextView(context).apply {
            text = "🔍"
            textSize = 13f
            setTextColor(theme.keyTextSecondary)
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT,
            )
        }
        pillContainer.addView(magnifier)

        val textArea = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val pl = dpPx(6f).toInt()
            setPadding(pl, 0, 0, 0)
            layoutParams = LayoutParams(0, LayoutParams.MATCH_PARENT, 1f)
        }
        queryLabel = TextView(context).apply {
            textSize = 15f
            setTextColor(theme.keyText)
            visibility = View.GONE
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT,
            )
        }
        cursorView = View(context).apply {
            setBackgroundColor(theme.micButtonBackground)
            layoutParams = LayoutParams(
                dpPx(1.5f).toInt(),
                dpPx(18f).toInt(),
            ).also { it.marginStart = dpPx(1f).toInt() }
        }
        placeholder = TextView(context).apply {
            text = "Search Emoji"
            textSize = 15f
            setTextColor(theme.keyTextSecondary)
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT,
            ).also { it.marginStart = dpPx(2f).toInt() }
        }
        textArea.addView(queryLabel)
        textArea.addView(cursorView)
        textArea.addView(placeholder)
        pillContainer.addView(textArea)

        clearButton = TextView(context).apply {
            text = "✕"
            textSize = 13f
            setTextColor(theme.keyText)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(theme.keyBackgroundPressed)
            }
            gravity = Gravity.CENTER
            isClickable = true
            isFocusable = true
            val size = dpPx(18f).toInt()
            layoutParams = LayoutParams(size, size).also {
                it.marginStart = dpPx(6f).toInt()
            }
            visibility = View.GONE
            setOnClickListener {
                performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                listener?.onClearQuery()
            }
        }
        pillContainer.addView(clearButton)

        addView(pillContainer)

        cursorAnimator = ObjectAnimator.ofFloat(cursorView, View.ALPHA, 1f, 0f).apply {
            duration = 530
            repeatMode = ObjectAnimator.REVERSE
            repeatCount = ObjectAnimator.INFINITE
            start()
        }

        resultsScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dpPx(40f).toInt(),
            ).also { it.topMargin = dpPx(4f).toInt() }
        }
        resultsRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        resultsScroll.addView(resultsRow)
        addView(resultsScroll)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cursorAnimator.cancel()
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (changedView !== this) return
        if (visibility == View.VISIBLE) {
            if (!cursorAnimator.isStarted) cursorAnimator.start()
        } else {
            cursorAnimator.cancel()
        }
    }

    fun setListener(l: Listener) {
        listener = l
    }

    fun setQuery(query: String, results: List<String>) {
        if (query.isEmpty()) {
            placeholder.visibility = View.VISIBLE
            queryLabel.visibility = View.GONE
            queryLabel.text = ""
            clearButton.visibility = View.GONE
        } else {
            placeholder.visibility = View.GONE
            queryLabel.visibility = View.VISIBLE
            queryLabel.text = query
            clearButton.visibility = View.VISIBLE
        }
        rebuildResults(results, hasQuery = query.isNotEmpty())
    }

    private fun rebuildResults(emojis: List<String>, hasQuery: Boolean) {
        resultsRow.removeAllViews()
        if (emojis.isEmpty()) {
            val empty = TextView(context).apply {
                text = if (hasQuery) "No emojis found" else ""
                textSize = 13f
                setTextColor(theme.keyTextSecondary)
                val pl = dpPx(8f).toInt()
                setPadding(pl, 0, pl, 0)
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.MATCH_PARENT,
                )
            }
            resultsRow.addView(empty)
            return
        }
        val capped = if (emojis.size > 60) emojis.subList(0, 60) else emojis
        for (emoji in capped) {
            resultsRow.addView(makeResultButton(emoji))
        }
    }

    private fun makeResultButton(emoji: String): View =
        TextView(context).apply {
            text = emoji
            textSize = 22f
            gravity = Gravity.CENTER
            background = pressableBackground(theme.keyBackgroundPressed)
            isClickable = true
            isFocusable = true
            setOnClickListener {
                performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                listener?.onEmojiSelected(emoji)
            }
            layoutParams = LinearLayout.LayoutParams(
                dpPx(40f).toInt(),
                LinearLayout.LayoutParams.MATCH_PARENT,
            ).also { it.marginEnd = dpPx(2f).toInt() }
        }
}
