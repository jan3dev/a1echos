package com.a1lab.echos.ime

import android.animation.ObjectAnimator
import android.content.Context
import android.content.res.Configuration
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Emoji search overlay. Replaces the picker grid while the user is typing
 * a search query. Layout (top -> bottom):
 *
 *   ┌─────────────────────────────────────────┐
 *   │ (←) Search emoji                        │  ← header
 *   ├─────────────────────────────────────────┤
 *   │ 😀 😄 😆 🤣 🙃 😉 …                       │  ← single 2-row grid,
 *   │ 😃 😁 😅 😂 🙂 😌 …                       │     pans horizontally as
 *   │                                         │     one block
 *   ├─────────────────────────────────────────┤
 *   │ 🔍 smile|                          ✕    │  ← search input
 *   └─────────────────────────────────────────┘
 *
 * The search input is a *display* — the keyboard view below this overlay
 * routes keystrokes into the IME's emoji-search query, which is fed back
 * here through [setQuery]. No EditText is involved; there's no second
 * focusable input target inside an IME.
 *
 * Selecting a result commits the emoji and stays in search mode so the
 * user can keep refining. Only the back arrow (or the IME's return-key
 * checkmark) leaves the search overlay.
 */
class EchosEmojiSearchOverlayView(context: Context) : LinearLayout(context) {

    interface Listener {
        fun onClearQuery()
        fun onEmojiSelected(emoji: String)
        /// Back-arrow tap — host should return to the emoji picker grid.
        fun onLeaveSearch()
    }

    private val theme = KeyTheme(context)
    private var listener: Listener? = null
    /// Cached default skin tone — refreshed inside [setQuery] so result
    /// cells render with whichever tone the picker last persisted.
    private var currentTone: String? = null

    private val queryLabel: TextView
    private val placeholder: TextView
    private val cursorView: View
    private val clearButton: TextView
    private val resultsScroll: HorizontalScrollView
    private val resultsGrid: GridLayout
    private val cursorAnimator: ObjectAnimator

    // Landscape collapses results to a single row + matching shorter
    // viewport so the QWERTY rows below get more vertical room. Portrait
    // keeps the original two-row grid.
    private val isLandscape: Boolean =
        context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    private val resultRowCount: Int = if (isLandscape) 1 else 2
    private val resultsHeightDp: Float =
        if (isLandscape) RESULT_CELL_HEIGHT_DP + 8f else RESULTS_HEIGHT_DP

    init {
        orientation = VERTICAL
        setBackgroundColor(theme.keyboardBackground)

        // ── Header: circle back arrow + "Search emoji" title ──
        val header = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val ph = dpPx(6f).toInt()
            setPadding(ph, dpPx(4f).toInt(), ph, dpPx(4f).toInt())
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dpPx(HEADER_HEIGHT_DP).toInt(),
            )
        }
        val backButton = ImageButton(context).apply {
            setImageResource(resolveDrawableId("ic_arrow_back"))
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(theme.specialKeyBackground)
            }
            setColorFilter(theme.keyText)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            setPadding(dpPx(8f).toInt(), dpPx(8f).toInt(), dpPx(8f).toInt(), dpPx(8f).toInt())
            isClickable = true
            isFocusable = true
            contentDescription = "Back to emoji picker"
            setOnClickListener {
                KeyFeedback.performKeyHaptic(this)
                listener?.onLeaveSearch()
            }
            layoutParams = LinearLayout.LayoutParams(
                dpPx(BACK_BUTTON_SIZE_DP).toInt(),
                dpPx(BACK_BUTTON_SIZE_DP).toInt(),
            ).also { it.marginEnd = dpPx(8f).toInt() }
        }
        val title = TextView(context).apply {
            text = "Search emoji"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(theme.keyText)
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f,
            )
        }
        header.addView(backButton)
        header.addView(title)
        addView(header)

        // ── Results: a single 2-row grid sitting inside one horizontal
        // scroll view, so panning either row moves the whole block. The
        // GridLayout uses VERTICAL orientation with rowCount=2, which
        // flows items top-then-bottom within each column before wrapping
        // to the next column.
        resultsScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            val ph = dpPx(4f).toInt()
            setPadding(ph, dpPx(4f).toInt(), ph, dpPx(4f).toInt())
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dpPx(resultsHeightDp).toInt(),
            )
        }
        resultsGrid = GridLayout(context).apply {
            rowCount = resultRowCount
            orientation = GridLayout.VERTICAL
        }
        resultsScroll.addView(resultsGrid)
        addView(resultsScroll)

        // ── Bottom: search input (display-only — keystrokes route into
        // the IME's emojiSearchQuery via the keyboard view below).
        val pillContainer = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = dpPx(18f)
                setColor(theme.specialKeyBackground)
            }
            val ph = dpPx(12f).toInt()
            setPadding(ph, 0, ph, 0)
            val lp = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dpPx(SEARCH_PILL_HEIGHT_DP).toInt(),
            ).also {
                val m = dpPx(8f).toInt()
                it.setMargins(m, dpPx(4f).toInt(), m, dpPx(6f).toInt())
            }
            layoutParams = lp
        }

        val searchIcon = ImageView(context).apply {
            setImageResource(resolveDrawableId("ic_search"))
            setColorFilter(theme.keyTextSecondary)
            layoutParams = LayoutParams(
                dpPx(16f).toInt(),
                dpPx(16f).toInt(),
            )
        }
        pillContainer.addView(searchIcon)

        val textArea = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpPx(8f).toInt(), 0, 0, 0)
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
            text = "Search"
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
            textSize = 12f
            setTextColor(theme.keyText)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(theme.keyBackgroundPressed)
            }
            gravity = Gravity.CENTER
            isClickable = true
            isFocusable = true
            val size = dpPx(20f).toInt()
            layoutParams = LayoutParams(size, size).also {
                it.marginStart = dpPx(6f).toInt()
            }
            visibility = View.GONE
            setOnClickListener {
                KeyFeedback.performKeyHaptic(this)
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
    }

    /// dp height the overlay claims when measured. Used by the IME to
    /// reposition the long-press key-preview balloon so it sits just above
    /// the keyboard, not the original top-bar.
    fun measuredOverlayHeightDp(): Float =
        (HEADER_HEIGHT_DP + 8f) + (resultsHeightDp + 8f) + (SEARCH_PILL_HEIGHT_DP + 10f)

    private fun resolveDrawableId(name: String): Int =
        resources.getIdentifier(name, "drawable", context.packageName)

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
        // Re-read the user's global tone every time the query changes so
        // a tone the user picked in the main picker (or a previous search
        // session) is applied to result cells without needing the overlay
        // to subscribe to preference changes.
        currentTone = SkinTonePreference.get(context)
        rebuildResults(results, hasQuery = query.isNotEmpty())
    }

    /// Drops every result into one GridLayout. With `rowCount=2` and
    /// `orientation=VERTICAL`, GridLayout fills column-first — so cell 0
    /// sits at row0/col0, cell 1 at row1/col0, cell 2 at row0/col1, etc.
    /// Wrapping the whole GridLayout in a single HorizontalScrollView is
    /// what makes the rows move together (the scroll position is shared).
    private fun rebuildResults(emojis: List<String>, hasQuery: Boolean) {
        resultsGrid.removeAllViews()
        if (emojis.isEmpty()) {
            val message = if (hasQuery) "No emojis found" else ""
            val emptyView = TextView(context).apply {
                text = message
                textSize = 13f
                setTextColor(theme.keyTextSecondary)
                val pl = dpPx(8f).toInt()
                setPadding(pl, 0, pl, 0)
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = GridLayout.LayoutParams().apply {
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 4)
                    rowSpec = GridLayout.spec(GridLayout.UNDEFINED, resultRowCount)
                }
            }
            resultsGrid.addView(emptyView)
            return
        }
        val capped = if (emojis.size > 80) emojis.subList(0, 80) else emojis
        for (emoji in capped) {
            resultsGrid.addView(makeResultButton(emoji))
        }
        resultsScroll.scrollTo(0, 0)
    }

    private fun makeResultButton(emoji: String): View {
        // Tone the displayed glyph and commit the toned form. Search
        // index keys stay base-only — only the render+commit path is
        // tone-aware. No skin-tone long-press popup in search (the
        // primary picker is the canonical entry point for changing the
        // default tone); the bottom-right triangle still surfaces the
        // affordance so users know there's a hidden gesture.
        val toned = SkinTone.applyTone(emoji, currentTone)
        return EmojiCellTextView(context).apply {
            text = toned
            showToneIndicator = SkinTone.isToneable(emoji)
            setIndicatorColor(theme.keyTextSecondary)
            textSize = 24f
            gravity = Gravity.CENTER
            background = pressableBackground(theme.keyBackgroundPressed)
            isClickable = true
            isFocusable = true
            setOnClickListener {
                KeyFeedback.keyPress(this)
                listener?.onEmojiSelected(toned)
            }
            layoutParams = GridLayout.LayoutParams().apply {
                width = dpPx(RESULT_CELL_WIDTH_DP).toInt()
                height = dpPx(RESULT_CELL_HEIGHT_DP).toInt()
                setMargins(
                    dpPx(RESULT_CELL_SPACING_DP / 2f).toInt(),
                    dpPx(2f).toInt(),
                    dpPx(RESULT_CELL_SPACING_DP / 2f).toInt(),
                    dpPx(2f).toInt(),
                )
            }
        }
    }

    companion object {
        private const val HEADER_HEIGHT_DP: Float = 48f
        private const val BACK_BUTTON_SIZE_DP: Float = 36f
        private const val RESULTS_HEIGHT_DP: Float = 96f
        private const val RESULT_CELL_WIDTH_DP: Float = 44f
        private const val RESULT_CELL_HEIGHT_DP: Float = 44f
        // Wider gap than the picker grid (2dp) — the spec calls out
        // "slightly larger x-space between emojis" in search mode.
        private const val RESULT_CELL_SPACING_DP: Float = 6f
        private const val SEARCH_PILL_HEIGHT_DP: Float = 36f
    }
}
