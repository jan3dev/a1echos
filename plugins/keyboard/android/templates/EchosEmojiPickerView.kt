package com.a1lab.echos.ime

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.util.AttributeSet
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * In-IME emoji picker styled after the native iPhone emoji keyboard
 * (which Android Gboard mostly mirrors, modulo small visual deltas):
 *
 *   ┌─────────────────────────────────────────┐
 *   │ 🔍  Search Emoji                        │  ← search bar (top, tap → search mode)
 *   ├─────────────────────────────────────────┤
 *   │  FREQUENTLY     SMILEYS & PEOPLE …     │
 *   │  😀 😃 😄  →    😀 😃 😄 😁 …            │  ← horizontal-scrolling
 *   │  😅 🤣 😂        😅 🤣 😂 🙂 …            │     section blocks, 5
 *   │  🙂 🙃 😉        🙂 🙃 😉 😊 …            │     emojis tall
 *   │  😊 😇 🥰        😊 😇 🥰 😍 …            │
 *   │  😍 🤩 😘        😍 🤩 😘 …               │
 *   ├─────────────────────────────────────────┤
 *   │ ABC ⏰ 😀 🐾 🍔 ⚽ ✈️ 💡 ❤️ 🏁  ⌫        │  ← bottom strip
 *   └─────────────────────────────────────────┘
 *
 * Shown when the user taps the smiley key — Android doesn't expose any way
 * for a third-party IME to programmatically open the system emoji panel,
 * so we render our own (same approach Gboard / SwiftKey take).
 *
 * Each section's emojis are laid out vertically in a `GridLayout` with
 * `rowCount=5` and `orientation=VERTICAL` — items flow top-to-bottom within
 * a column, then wrap to the next column. Sections sit side-by-side inside
 * a single `HorizontalScrollView`.
 */
class EchosEmojiPickerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : LinearLayout(context, attrs) {

    interface Listener {
        fun onEmojiSelected(emoji: String)
        fun onBackToLetters()
        fun onDeleteCharacter()
        fun onDeleteWord()
        /// Tap on the search bar — host should enter the IME's emoji-search
        /// mode (shows the search overlay above QWERTY and routes character
        /// input into the search query).
        fun onActivateSearch()
    }

    private val theme = KeyTheme(context)
    private var listener: Listener? = null

    private val searchPill: LinearLayout
    private val sectionsScroll: HorizontalScrollView
    private val sectionsRow: LinearLayout
    private val bottomStrip: LinearLayout
    private val abcButton: TextView
    private val deleteButton: TextView
    private val categoryButtons = mutableListOf<TextView>()

    private val visibleCategories = mutableListOf<EmojiCategory>()
    /** Per-section start position within `sectionsRow`'s child indices, so
     *  category taps can scroll the matching block into view. */
    private val sectionViews = mutableListOf<View>()
    private var currentCategoryIndex = 0
    private var suppressScrollSync = false

    private val deleteRepeater = KeyDeleteRepeater(
        onCharDelete = { listener?.onDeleteCharacter() },
        onWordDelete = { listener?.onDeleteWord() },
    )

    init {
        orientation = VERTICAL
        setBackgroundColor(theme.keyboardBackground)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        // ── Top: search bar ──
        searchPill = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = dp(9f)
                setColor(theme.specialKeyBackground)
            }
            val ph = dp(10f).toInt()
            setPadding(ph, 0, ph, 0)
            isClickable = true
            isFocusable = true
            setOnClickListener {
                performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                listener?.onActivateSearch()
            }
            val lp = LayoutParams(LayoutParams.MATCH_PARENT, dp(SEARCH_BAR_HEIGHT_DP).toInt())
            val pm = dp(8f).toInt()
            lp.setMargins(pm, dp(4f).toInt(), pm, dp(4f).toInt())
            layoutParams = lp
        }
        val magnifier = TextView(context).apply {
            text = "🔍" // 🔍 magnifying glass
            textSize = 14f
            setTextColor(theme.keyTextSecondary)
        }
        val placeholder = TextView(context).apply {
            text = "Search Emoji"
            textSize = 15f
            setTextColor(theme.keyTextSecondary)
            val pl = dp(8f).toInt()
            setPadding(pl, 0, 0, 0)
        }
        searchPill.addView(magnifier)
        searchPill.addView(placeholder)
        addView(searchPill)

        // ── Middle: horizontal-scrolling section blocks ──
        sectionsScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dp(GRID_HEIGHT_DP).toInt(),
            )
        }
        sectionsRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
        }
        sectionsScroll.addView(sectionsRow)
        addView(sectionsScroll)

        attachScrollListener()

        // ── Bottom: category strip with ABC + categories + delete ──
        bottomStrip = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val ps = dp(4f).toInt()
            setPadding(ps, dp(2f).toInt(), ps, dp(4f).toInt())
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dp(STRIP_HEIGHT_DP).toInt(),
            )
        }

        abcButton = TextView(context).apply {
            text = "ABC"
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(theme.keyText)
            gravity = Gravity.CENTER
            background = pressableTransparent()
            isClickable = true
            isFocusable = true
            setOnClickListener {
                performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                listener?.onBackToLetters()
            }
            val pad = dp(10f).toInt()
            setPadding(pad, 0, pad, 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.MATCH_PARENT,
            )
        }
        bottomStrip.addView(abcButton)

        // Category icon buttons are added in `rebuild()`.

        deleteButton = TextView(context).apply {
            text = "⌫"
            textSize = 18f
            setTextColor(theme.keyText)
            gravity = Gravity.CENTER
            background = pressableTransparent()
            isClickable = true
            isFocusable = true
            val pad = dp(10f).toInt()
            setPadding(pad, 0, pad, 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.MATCH_PARENT,
            )
        }
        addView(bottomStrip)
        wireDeleteRepeat()

        rebuild()
    }

    fun setListener(l: Listener) {
        listener = l
    }

    /** Refreshes the recents tab. Called when the picker becomes visible. */
    fun refresh() {
        rebuild()
    }

    // MARK: - Build

    private fun rebuild() {
        // Always pin recents as the first tab — even when empty — so users
        // see where their picks will land. The grid for that section stays
        // empty until the first emoji is picked and the picker reopens.
        visibleCategories.clear()
        visibleCategories.add(EmojiCategory.RECENTS)
        visibleCategories.addAll(
            EmojiCategory.values().filter { it != EmojiCategory.RECENTS }
        )

        // Rebuild grid.
        sectionsRow.removeAllViews()
        sectionViews.clear()
        for (cat in visibleCategories) {
            val emojis = EmojiData.emojis(cat, context)
            val block = buildSectionBlock(cat.displayName, emojis)
            sectionViews.add(block)
            sectionsRow.addView(block)
        }

        // Rebuild bottom strip.
        rebuildCategoryButtons()

        currentCategoryIndex = 0
        updateCategorySelection()
    }

    private fun buildSectionBlock(title: String, emojis: List<String>): View {
        val block = LinearLayout(context).apply {
            orientation = VERTICAL
            // Pad each section so they read as distinct horizontally-tiled
            // blocks rather than one continuous emoji stripe.
            val padH = dp(8f).toInt()
            setPadding(padH, 0, padH, 0)
        }
        val header = TextView(context).apply {
            text = title.uppercase()
            textSize = 11f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(theme.keyTextSecondary)
            val pad = dp(2f).toInt()
            setPadding(pad, 0, pad, dp(2f).toInt())
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(SECTION_HEADER_HEIGHT_DP).toInt(),
            )
        }
        block.addView(header)

        val grid = GridLayout(context).apply {
            rowCount = 5
            orientation = GridLayout.VERTICAL
        }
        // Slot = cell content + inter-cell margin. Cells get a small margin
        // so they don't bleed into each other; the visible emoji glyph
        // remains centred in the slot.
        val cellSidePx = dp(CELL_SIDE_DP).toInt()
        val cellMarginPx = dp(CELL_MARGIN_DP).toInt()
        for (emoji in emojis) {
            val cell = TextView(context).apply {
                text = emoji
                textSize = 24f
                gravity = Gravity.CENTER
                background = pressableTransparent()
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    RecentEmojis.record(context, emoji)
                    listener?.onEmojiSelected(emoji)
                }
                val lp = GridLayout.LayoutParams().apply {
                    width = cellSidePx
                    height = cellSidePx
                    setMargins(cellMarginPx, cellMarginPx, cellMarginPx, cellMarginPx)
                }
                layoutParams = lp
            }
            grid.addView(cell)
        }
        block.addView(grid)
        return block
    }

    private fun rebuildCategoryButtons() {
        // Tear down only the category buttons (preserve ABC at start and
        // delete at end, but we'll add delete last after rebuilding).
        while (bottomStrip.childCount > 1) {
            bottomStrip.removeViewAt(1)
        }
        categoryButtons.clear()

        for ((idx, cat) in visibleCategories.withIndex()) {
            val btn = TextView(context).apply {
                text = cat.symbolGlyph
                textSize = 16f
                gravity = Gravity.CENTER
                contentDescription = cat.displayName
                background = categoryButtonBg()
                isClickable = true
                isFocusable = true
                setOnClickListener { scrollToCategory(idx) }
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    1f,
                )
            }
            bottomStrip.addView(btn)
            categoryButtons.add(btn)
        }
        bottomStrip.addView(deleteButton)
    }

    /** Pill background drawable that lights up when the button is selected. */
    private fun categoryButtonBg(): StateListDrawable {
        val corner = dp(10f)
        val pressed = GradientDrawable().apply {
            cornerRadius = corner
            setColor(theme.keyBackgroundPressed)
        }
        val selected = GradientDrawable().apply {
            cornerRadius = corner
            setColor(theme.specialKeyBackground)
        }
        val transparent = GradientDrawable().apply {
            cornerRadius = corner
            setColor(Color.TRANSPARENT)
        }
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), pressed)
            addState(intArrayOf(android.R.attr.state_selected), selected)
            addState(intArrayOf(), transparent)
        }
    }

    private fun updateCategorySelection() {
        for ((idx, btn) in categoryButtons.withIndex()) {
            btn.isSelected = (idx == currentCategoryIndex)
            btn.alpha = if (btn.isSelected) 1f else 0.6f
        }
    }

    private fun scrollToCategory(idx: Int) {
        if (idx !in sectionViews.indices) return
        currentCategoryIndex = idx
        updateCategorySelection()
        suppressScrollSync = true
        val target = sectionViews[idx]
        sectionsScroll.post {
            sectionsScroll.smoothScrollTo(target.left, 0)
        }
        sectionsScroll.postDelayed({ suppressScrollSync = false }, 250)
    }

    /** Picks the active category by finding the leftmost section that's at
     *  least half-visible inside the scroll view. */
    private fun attachScrollListener() {
        sectionsScroll.viewTreeObserver.addOnScrollChangedListener {
            if (suppressScrollSync) return@addOnScrollChangedListener
            val scrollX = sectionsScroll.scrollX
            val midX = scrollX + sectionsScroll.width / 4
            var picked = 0
            for ((idx, view) in sectionViews.withIndex()) {
                if (view.left <= midX) picked = idx else break
            }
            if (picked != currentCategoryIndex) {
                currentCategoryIndex = picked
                updateCategorySelection()
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun wireDeleteRepeat() {
        deleteButton.setOnTouchListener { view, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    view.isPressed = true
                    view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    deleteRepeater.start()
                    true
                }
                MotionEvent.ACTION_UP -> {
                    view.isPressed = false
                    val didRepeat = deleteRepeater.didRepeat
                    deleteRepeater.cancel()
                    if (!didRepeat) listener?.onDeleteCharacter()
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    view.isPressed = false
                    deleteRepeater.cancel()
                    true
                }
                else -> false
            }
        }
    }

    private fun pressableTransparent(): StateListDrawable =
        pressableBackground(theme.keyBackgroundPressed)

    private fun dp(value: Float): Float = dpPx(value)

    companion object {
        private const val SEARCH_BAR_HEIGHT_DP: Float = 36f
        private const val STRIP_HEIGHT_DP: Float = 36f
        private const val SECTION_HEADER_HEIGHT_DP: Float = 16f
        // Cell content + a 2dp margin on each side = ~40dp slot, which
        // matches stock Gboard. 5 rows × 40dp slot + 16dp header = 216dp
        // grid height. Bumped from the original 31dp/174dp combo where
        // cells looked cramped and only ~3 visible columns read as
        // distinct on iPhone-narrow viewports.
        private const val CELL_SIDE_DP: Float = 36f
        private const val CELL_MARGIN_DP: Float = 2f
        private const val GRID_HEIGHT_DP: Float = 216f
    }
}
