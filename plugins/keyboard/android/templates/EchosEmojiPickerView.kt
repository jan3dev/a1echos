package com.a1lab.echos.ime

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.util.AttributeSet
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * In-IME emoji picker laid out like stock Gboard:
 *
 *   ┌─────────────────────────────────────────┐
 *   │ (←) [🔍 Search emoji]  🕒 🙂 🐾 🍔 ⚽ ✈ …  │  ← header
 *   ├─────────────────────────────────────────┤
 *   │ Recent Emoji                          │ │
 *   │ 😀 😃 😄 😁 😆 😅 🤣 😂                  │ │
 *   │ Smileys & Emotions                    │ │
 *   │ 🙂 🙃 😉 😊 😇 🥰 😍 🤩                  │ │  ← 8-col vertical grid
 *   │ ...                                   │ │
 *   └─────────────────────────────────────────┘
 *
 * Components:
 * - **Back arrow** lives in a circular surface so it matches the system
 *   icon shape Gboard uses.
 * - **Search pill** sits next to the back arrow and is the primary tap
 *   target for entering search mode.
 * - **Category strip** scrolls horizontally; when the user scrolls it past
 *   a small threshold, the search pill collapses out so the category icons
 *   own the full row (Gboard does the same).
 * - **Body** is a vertical ScrollView with one section per category. Each
 *   section is a small title above an 8-column `GridLayout`.
 */
class EchosEmojiPickerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

    interface Listener {
        fun onEmojiSelected(emoji: String)
        fun onBackToLetters()
        /// Tap on the search pill — host should enter the IME's emoji-search
        /// mode (shows the search overlay above QWERTY and routes character
        /// input into the search query).
        fun onActivateSearch()
    }

    private val theme = KeyTheme(context)
    private var listener: Listener? = null

    /// Stacks the header + sections-scroll vertically. Lives inside this
    /// FrameLayout so the [popupView] can overlay it for the long-press
    /// skin-tone variant strip.
    private val contentColumn: LinearLayout
    private val header: LinearLayout
    private val backButton: ImageButton
    private val searchPill: LinearLayout
    private val categoryScroll: HorizontalScrollView
    private val categoryRow: LinearLayout
    private val sectionsScroll: ScrollView
    private val sectionsColumn: LinearLayout
    private val categoryButtons = mutableListOf<View>()
    private val popupView: SkinTonePopupView
    /// User's currently chosen default skin tone modifier, or null for
    /// yellow. Refreshed from [SkinTonePreference] each time [refresh] is
    /// called and updated locally when a long-press popup commits a new
    /// selection so the next [retoneAllCells] picks up the change.
    private var currentTone: String? = null

    private val visibleCategories = mutableListOf<EmojiCategory>()
    private val sectionViews = mutableListOf<View>()
    private var currentCategoryIndex = 0
    private var suppressScrollSync = false
    /// Set true once [rebuild] has wired up every category section (the
    /// first time the picker is shown). Subsequent [refresh] calls then
    /// only re-render the Recents section, since the static categories
    /// don't change. ~6x faster reopen on a populated grid.
    private var staticSectionsBuilt = false
    /// Pending grid fills for sections deferred past the first frame so
    /// the initial paint isn't blocked by the full ~1100-cell build.
    /// Each entry pairs a placeholder section shell with the emoji list
    /// that still needs to be inflated into it.
    private val pendingSectionFills: ArrayDeque<Pair<LinearLayout, List<String>>> =
        ArrayDeque()
    /// Original LayoutParams for the search pill — cached so we can shrink
    /// it to zero width when the category strip scrolls and restore it
    /// when scroll returns to the start.
    private val searchPillExpandedWidthPx: Int
    private val searchPillIconWidthPx: Int
    /// One-way collapse latch — the pill starts expanded each time the
    /// picker is shown, animates to icon-only when the user first scrolls
    /// the category strip past a small threshold, and stays there for
    /// the rest of the session. This avoids the layout-feedback loop
    /// that caused the flicker when the pill tried to re-expand from
    /// scroll position alone.
    private var searchPillCollapsed = false
    private var collapseAnimator: ValueAnimator? = null

    init {
        setBackgroundColor(theme.keyboardBackground)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        // Vertical stack of header + sections-scroll. Lives inside this
        // FrameLayout so the skin-tone popup can overlay it.
        contentColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.WRAP_CONTENT,
            )
        }

        // ── Header: back arrow + search pill + category strip ──
        header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val ph = dp(6f).toInt()
            setPadding(ph, dp(4f).toInt(), ph, dp(4f).toInt())
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(HEADER_HEIGHT_DP).toInt(),
            )
        }

        backButton = ImageButton(context).apply {
            setImageResource(resolveDrawableId("ic_arrow_back"))
            contentDescription = "Back to keyboard"
            background = circleBackground(theme.specialKeyBackground)
            setColorFilter(theme.keyText)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            setPadding(dp(8f).toInt(), dp(8f).toInt(), dp(8f).toInt(), dp(8f).toInt())
            isClickable = true
            isFocusable = true
            setOnClickListener {
                KeyFeedback.performKeyHaptic(this)
                listener?.onBackToLetters()
            }
            layoutParams = LinearLayout.LayoutParams(
                dp(BACK_BUTTON_SIZE_DP).toInt(),
                dp(BACK_BUTTON_SIZE_DP).toInt(),
            ).also { it.marginEnd = dp(6f).toInt() }
        }
        header.addView(backButton)

        searchPillExpandedWidthPx = dp(SEARCH_PILL_WIDTH_DP).toInt()
        searchPillIconWidthPx = dp(SEARCH_PILL_HEIGHT_DP).toInt()
        searchPill = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = dp(18f)
                setColor(theme.specialKeyBackground)
            }
            val ph = dp(12f).toInt()
            setPadding(ph, 0, ph, 0)
            isClickable = true
            isFocusable = true
            setOnClickListener {
                KeyFeedback.performKeyHaptic(this)
                listener?.onActivateSearch()
            }
            layoutParams = LinearLayout.LayoutParams(
                searchPillExpandedWidthPx,
                dp(SEARCH_PILL_HEIGHT_DP).toInt(),
            ).also { it.marginEnd = dp(6f).toInt() }
        }
        val searchIcon = ImageView(context).apply {
            setImageResource(resolveDrawableId("ic_search"))
            setColorFilter(theme.keyTextSecondary)
            layoutParams = LinearLayout.LayoutParams(
                dp(16f).toInt(),
                dp(16f).toInt(),
            )
        }
        val placeholder = TextView(context).apply {
            text = "Search emoji"
            textSize = 14f
            setTextColor(theme.keyTextSecondary)
            setPadding(dp(8f).toInt(), 0, 0, 0)
            // Tagged so the collapse animator can fade just the text
            // (the icon stays visible at the iconOnly stage).
            tag = "pill-text"
        }
        searchPill.addView(searchIcon)
        searchPill.addView(placeholder)
        // searchPill is added INSIDE categoryRow so it scrolls together
        // with the category icons — once it's collapsed to icon-only, it
        // behaves like any other scrollable item and can pass behind the
        // (fixed) back arrow.

        categoryScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f,
            )
        }
        categoryRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        categoryRow.addView(searchPill)
        categoryScroll.addView(categoryRow)
        header.addView(categoryScroll)

        // First time the user pans the category strip, collapse the
        // search pill down to icon-only via a one-shot ValueAnimator.
        // This is intentionally one-way (the pill doesn't re-expand on
        // scroll-back) so the listener can't ping-pong off the layout
        // change. The next `refresh()` (e.g. re-opening the picker)
        // resets it to expanded.
        categoryScroll.viewTreeObserver.addOnScrollChangedListener {
            if (searchPillCollapsed) return@addOnScrollChangedListener
            if (categoryScroll.scrollX > dp(COLLAPSE_TRIGGER_DP)) {
                searchPillCollapsed = true
                animatePillCollapse()
            }
        }

        contentColumn.addView(header)

        // ── Body: vertically scrolling sections ──
        sectionsScroll = ScrollView(context).apply {
            isVerticalScrollBarEnabled = true
            scrollBarStyle = SCROLLBARS_OUTSIDE_OVERLAY
            overScrollMode = OVER_SCROLL_NEVER
            // Landscape compresses the picker to 3 visible rows so the
            // QWERTY rows below have enough vertical room. Portrait
            // keeps the full 6-row viewport.
            val visibleRows = if (
                resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
            ) 3 else 6
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(visibleRows * CELL_HEIGHT_DP).toInt(),
            )
        }
        sectionsColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            val ph = dp(6f).toInt()
            setPadding(ph, 0, ph, dp(8f).toInt())
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            )
        }
        sectionsScroll.addView(sectionsColumn)
        contentColumn.addView(sectionsScroll)

        addView(contentColumn)

        // Skin-tone variant popup sits on top of the content column so it
        // can draw outside the sections grid (above row 5/6 cells whose
        // popup would otherwise be clipped by the ScrollView). The popup
        // calls back into [commitFromPopup] when the user taps a variant
        // during the sticky post-release phase.
        popupView = SkinTonePopupView(context).apply {
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT,
            )
            onCommit = { variant -> commitFromPopup(variant) }
        }
        addView(popupView)

        attachScrollListener()
        rebuild()
    }

    fun setListener(l: Listener) {
        listener = l
    }

    /**
     * Brings the picker up to date with the latest tone preference + Recents
     * list. First call (cold) lays out the whole grid; later calls only
     * rebuild Recents (which is the only thing that changes between opens)
     * and re-apply tone if the user changed their default elsewhere.
     */
    fun refresh() {
        val newTone = SkinTonePreference.get(context)
        val toneChanged = newTone != currentTone
        currentTone = newTone

        if (!staticSectionsBuilt) {
            rebuild()
        } else {
            refreshRecentsOnly()
            if (toneChanged) retoneAllCells()
            currentCategoryIndex = 0
            updateCategorySelection()
            sectionsScroll.scrollTo(0, 0)
        }
        // Each time the picker reopens, restore the expanded pill so
        // the search affordance is visible — re-establishes the one-way
        // collapse-on-first-scroll behavior.
        expandPillImmediately()
    }

    // MARK: - Build

    private fun rebuild() {
        visibleCategories.clear()
        visibleCategories.add(EmojiCategory.RECENTS)
        visibleCategories.addAll(
            EmojiCategory.values().filter { it != EmojiCategory.RECENTS }
        )

        sectionsColumn.removeAllViews()
        sectionViews.clear()
        pendingSectionFills.clear()
        // Build the first few sections synchronously so the picker has
        // content under the viewport before the first frame paints; queue
        // the rest as empty shells that fill in over the next few frames.
        for ((idx, cat) in visibleCategories.withIndex()) {
            val emojis = EmojiData.emojis(cat, context)
            if (idx < INITIAL_SYNC_SECTIONS) {
                val section = buildSection(cat.displayName, emojis)
                sectionViews.add(section)
                sectionsColumn.addView(section)
            } else {
                val shell = buildSection(cat.displayName, emptyList()) as LinearLayout
                sectionViews.add(shell)
                sectionsColumn.addView(shell)
                pendingSectionFills.add(shell to emojis)
            }
        }

        rebuildCategoryButtons()
        currentCategoryIndex = 0
        updateCategorySelection()
        sectionsScroll.scrollTo(0, 0)
        staticSectionsBuilt = true
        scheduleNextSectionFill()
    }

    /// Pops one pending section and fills it on the next frame, then
    /// re-posts itself. Spreading the work out keeps each frame short
    /// enough that the picker stays responsive while the grid finishes
    /// building in the background.
    private fun scheduleNextSectionFill() {
        val next = pendingSectionFills.removeFirstOrNull() ?: return
        post {
            fillSection(next.first, next.second)
            scheduleNextSectionFill()
        }
    }

    private fun fillSection(shell: LinearLayout, emojis: List<String>) {
        if (emojis.isEmpty()) return
        val grid = GridLayout(context).apply {
            columnCount = COLUMN_COUNT
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        }
        for (emoji in emojis) {
            grid.addView(makeEmojiCell(emoji))
        }
        shell.addView(grid)
    }

    /// Rebuilds only the Recents section in place. Used on every open
    /// after the first, since Recents is the one list that meaningfully
    /// changes between picker shows.
    private fun refreshRecentsOnly() {
        val recentsSection = sectionViews.firstOrNull() as? LinearLayout ?: return
        // Strip the old grid; keep the section header (child 0).
        while (recentsSection.childCount > 1) {
            recentsSection.removeViewAt(1)
        }
        val emojis = EmojiData.emojis(EmojiCategory.RECENTS, context)
        if (emojis.isEmpty()) return
        val grid = GridLayout(context).apply {
            columnCount = COLUMN_COUNT
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        }
        for (emoji in emojis) {
            grid.addView(makeEmojiCell(emoji))
        }
        recentsSection.addView(grid)
    }

    private fun buildSection(title: String, emojis: List<String>): View {
        val block = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).also { it.topMargin = dp(8f).toInt() }
        }
        val header = TextView(context).apply {
            text = title
            textSize = 12f
            setTextColor(theme.keyTextSecondary)
            setPadding(dp(4f).toInt(), 0, 0, dp(4f).toInt())
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(SECTION_HEADER_HEIGHT_DP).toInt(),
            )
        }
        block.addView(header)

        if (emojis.isEmpty()) return block

        val grid = GridLayout(context).apply {
            columnCount = COLUMN_COUNT
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        }
        for (emoji in emojis) {
            grid.addView(makeEmojiCell(emoji))
        }
        block.addView(grid)
        return block
    }

    /**
     * Builds one emoji cell. Tagged with the *base* emoji (no tone) so
     * [retoneAllCells] can re-render every toneable cell when the user
     * picks a new default. The cell uses a custom touch listener instead
     * of [setOnClickListener] because we need to schedule a long-press
     * runnable for the skin-tone variant popup.
     */
    private fun makeEmojiCell(baseEmoji: String): View {
        val toneable = SkinTone.isToneable(baseEmoji)
        val cell = EmojiCellTextView(context).apply {
            text = SkinTone.applyTone(baseEmoji, currentTone)
            tag = baseEmoji
            showToneIndicator = toneable
            setIndicatorColor(theme.keyTextSecondary)
            textSize = 28f
            gravity = Gravity.CENTER
            background = pressableBackground(theme.keyBackgroundPressed)
            isClickable = true
            isFocusable = true
            layoutParams = GridLayout.LayoutParams().apply {
                width = 0
                height = dp(CELL_HEIGHT_DP).toInt()
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1, GridLayout.FILL, 1f)
                rowSpec = GridLayout.spec(GridLayout.UNDEFINED)
                val m = dp(1f).toInt()
                setMargins(m, m, m, m)
            }
        }

        attachCellTouchListener(cell, baseEmoji)
        return cell
    }

    /**
     * Wires a cell to:
     *  - schedule a long-press popup if the base is skin-tone-able
     *  - forward drag events to the popup while it's open
     *  - commit either the highlighted variant (popup release) or the
     *    cell's current text (plain tap) on ACTION_UP
     *
     * Touch is captured at the cell so a finger that drifts upward into
     * the popup area still drives the highlight (Android's touch stream
     * stays bound to the ACTION_DOWN target). We disallow ScrollView
     * interception while the popup is open so a downward drag past the
     * popup doesn't trigger a vertical scroll.
     */
    private fun attachCellTouchListener(cell: View, baseEmoji: String) {
        val variants = SkinTone.variantsFor(baseEmoji)
        var longPressRunnable: Runnable? = null
        var longPressFired = false
        var downX = 0f

        cell.setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    v.isPressed = true
                    downX = event.x
                    longPressFired = false
                    if (variants != null) {
                        val runnable = Runnable {
                            longPressFired = true
                            v.isPressed = false
                            sectionsScroll.requestDisallowInterceptTouchEvent(true)
                            val anchor = computeCellRectInPopup(v)
                            val initialIndex = indexForTone(currentTone)
                            val pointerX = anchor.left + downX
                            popupView.show(anchor, variants, initialIndex, pointerX)
                            KeyFeedback.performLongPressHaptic(v)
                        }
                        longPressRunnable = runnable
                        cell.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
                    }
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (popupView.isOpen()) {
                        val anchor = computeCellRectInPopup(v)
                        popupView.updateHighlight(anchor.left + event.x, anchor.top + event.y)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    v.isPressed = false
                    longPressRunnable?.let { cell.removeCallbacks(it) }
                    longPressRunnable = null
                    if (popupView.isOpen()) {
                        if (popupView.isDraggedSelection()) {
                            // Classic Gboard drag-select: user dragged
                            // during the long-press and released on a
                            // variant. Commit and dismiss.
                            val selected = popupView.selectedVariant()
                            popupView.dismiss()
                            if (selected != null) commitFromPopup(selected)
                        }
                        // No drag: leave the popup open so the user can
                        // pick by tapping a cell. The popup now consumes
                        // touch events directly (see SkinTonePopupView).
                    } else if (!longPressFired) {
                        commitFromTap(cell as TextView, baseEmoji)
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    v.isPressed = false
                    longPressRunnable?.let { cell.removeCallbacks(it) }
                    longPressRunnable = null
                    if (popupView.isOpen()) popupView.dismiss()
                    true
                }
                else -> false
            }
        }
    }

    /// The cell's bounds expressed in [popupView]'s coordinate space, which
    /// is the same as this FrameLayout's coordinate space — [popupView]
    /// is a direct child sized MATCH_PARENT/MATCH_PARENT.
    private fun computeCellRectInPopup(cell: View): RectF {
        val rect = Rect(0, 0, cell.width, cell.height)
        offsetDescendantRectToMyCoords(cell, rect)
        return RectF(rect)
    }

    /// Maps the current default tone to its index in the popup's
    /// variants list: index 0 is the bare base (yellow), 1..5 the five
    /// Fitzpatrick modifiers. Matches the popup's `initialIndex` arg so a
    /// long-press + immediate release commits the existing default.
    private fun indexForTone(tone: String?): Int {
        if (tone == null) return 0
        val idx = SkinTone.modifiers.indexOf(tone)
        return if (idx >= 0) idx + 1 else 0
    }

    /// Handles a regular tap commit. The cell's text already reflects
    /// the current tone, so we commit that directly.
    private fun commitFromTap(cell: TextView, baseEmoji: String) {
        KeyFeedback.keyPress(cell)
        val committed = cell.text?.toString().takeUnless { it.isNullOrEmpty() }
            ?: SkinTone.applyTone(baseEmoji, currentTone)
        RecentEmojis.record(context, SkinTone.stripTone(committed))
        listener?.onEmojiSelected(committed)
    }

    /// Handles a long-press popup release. Updates the global tone
    /// default (so every other toneable emoji re-renders) and commits
    /// the chosen variant.
    private fun commitFromPopup(selected: String) {
        val newTone = SkinTone.modifiers.firstOrNull { selected.endsWith(it) }
        if (newTone != currentTone) {
            currentTone = newTone
            SkinTonePreference.set(context, newTone)
            retoneAllCells()
        }
        KeyFeedback.keyPress(this)
        RecentEmojis.record(context, SkinTone.stripTone(selected))
        listener?.onEmojiSelected(selected)
    }

    /// Walks every cell currently in the sections grid and re-applies
    /// [currentTone] to those whose tag is a toneable base. Cheap — the
    /// picker has at most ~700 cells and the lookup is a HashSet hit.
    private fun retoneAllCells() {
        for (i in 0 until sectionsColumn.childCount) {
            val section = sectionsColumn.getChildAt(i) as? LinearLayout ?: continue
            for (j in 0 until section.childCount) {
                val grid = section.getChildAt(j) as? GridLayout ?: continue
                for (k in 0 until grid.childCount) {
                    val cell = grid.getChildAt(k) as? TextView ?: continue
                    val base = cell.tag as? String ?: continue
                    if (SkinTone.isToneable(base)) {
                        cell.text = SkinTone.applyTone(base, currentTone)
                    }
                }
            }
        }
    }

    private fun rebuildCategoryButtons() {
        // Preserve the searchPill (always the first child of categoryRow);
        // tear down only the previously-added category buttons.
        while (categoryRow.childCount > 1) {
            categoryRow.removeViewAt(1)
        }
        categoryButtons.clear()
        for ((idx, cat) in visibleCategories.withIndex()) {
            val btn = ImageView(context).apply {
                setImageResource(resolveDrawableId(cat.iconName))
                setColorFilter(theme.keyText)
                scaleType = ImageView.ScaleType.CENTER_INSIDE
                contentDescription = cat.displayName
                background = categoryButtonBg()
                isClickable = true
                isFocusable = true
                val ip = dp(8f).toInt()
                setPadding(ip, ip, ip, ip)
                setOnClickListener { scrollToCategory(idx) }
                layoutParams = LinearLayout.LayoutParams(
                    dp(CATEGORY_BUTTON_WIDTH_DP).toInt(),
                    LinearLayout.LayoutParams.MATCH_PARENT,
                ).also { it.marginEnd = dp(2f).toInt() }
            }
            categoryRow.addView(btn)
            categoryButtons.add(btn)
        }
    }

    /// Pill drawable that lights up when the category is selected.
    private fun categoryButtonBg(): StateListDrawable {
        val corner = dp(14f)
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

    private fun circleBackground(color: Int): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
        }

    private fun resolveDrawableId(name: String): Int =
        resources.getIdentifier(name, "drawable", context.packageName)

    private fun updateCategorySelection() {
        for ((idx, btn) in categoryButtons.withIndex()) {
            btn.isSelected = (idx == currentCategoryIndex)
            btn.alpha = if (btn.isSelected) 1f else 0.55f
        }
    }

    private fun scrollToCategory(idx: Int) {
        if (idx !in sectionViews.indices) return
        currentCategoryIndex = idx
        updateCategorySelection()
        suppressScrollSync = true
        val target = sectionViews[idx]
        sectionsScroll.post {
            sectionsScroll.smoothScrollTo(0, target.top)
        }
        sectionsScroll.postDelayed({ suppressScrollSync = false }, 250)
    }

    private fun attachScrollListener() {
        sectionsScroll.viewTreeObserver.addOnScrollChangedListener {
            if (suppressScrollSync) return@addOnScrollChangedListener
            val scrollY = sectionsScroll.scrollY + dp(8f)
            var picked = 0
            for ((idx, view) in sectionViews.withIndex()) {
                if (view.top <= scrollY) picked = idx else break
            }
            if (picked != currentCategoryIndex) {
                currentCategoryIndex = picked
                updateCategorySelection()
            }
        }
    }

    /// One-shot collapse animation. Shrinks the pill's layout width from
    /// expanded down to icon-only (= one category-button width) and
    /// fades the inner placeholder text so the user sees a smooth
    /// transition into the icon-only state. The scroll position the
    /// user produced is preserved (we don't touch scrollX).
    private fun animatePillCollapse() {
        collapseAnimator?.cancel()
        val params = searchPill.layoutParams as LinearLayout.LayoutParams
        val startWidth = params.width
        val endWidth = searchPillIconWidthPx
        val animator = ValueAnimator.ofInt(startWidth, endWidth).apply {
            duration = 220
            addUpdateListener { anim ->
                val w = anim.animatedValue as Int
                params.width = w
                searchPill.layoutParams = params
                val progress = ((startWidth - w).toFloat() / (startWidth - endWidth).toFloat())
                    .coerceIn(0f, 1f)
                searchPill.findViewWithTag<View>("pill-text")?.alpha = 1f - progress
            }
            start()
        }
        collapseAnimator = animator
    }

    /// Restores the search pill to its expanded state. Invoked from
    /// [refresh] so each picker session starts with the "Search emoji"
    /// affordance visible. Cancels any in-flight collapse.
    private fun expandPillImmediately() {
        collapseAnimator?.cancel()
        searchPillCollapsed = false
        val params = searchPill.layoutParams as LinearLayout.LayoutParams
        params.width = searchPillExpandedWidthPx
        searchPill.layoutParams = params
        searchPill.findViewWithTag<View>("pill-text")?.alpha = 1f
        // Also reset the category scroll so the next collapse-trigger
        // requires a fresh pan.
        categoryScroll.scrollX = 0
    }

    private fun dp(value: Float): Float = dpPx(value)

    companion object {
        private const val HEADER_HEIGHT_DP: Float = 48f
        // Back arrow has the same visual size as a category button so the
        // "search icon scrolls off, back arrow stays" transition reads as
        // a continuous strip of equally-sized circular buttons.
        private const val BACK_BUTTON_SIZE_DP: Float = 38f
        private const val SEARCH_PILL_WIDTH_DP: Float = 150f
        private const val SEARCH_PILL_HEIGHT_DP: Float = 38f
        private const val CATEGORY_BUTTON_WIDTH_DP: Float = 38f
        private const val SECTION_HEADER_HEIGHT_DP: Float = 22f
        // 8-column grid sized so exactly 6 rows of emojis fit in the
        // visible viewport (the user wants noticeably larger glyphs).
        private const val COLUMN_COUNT: Int = 8
        private const val CELL_HEIGHT_DP: Float = 46f
        /// Number of sections built synchronously during the cold open.
        /// RECENTS + SMILEYS cover the viewport for almost everyone;
        /// the remaining seven categories fill in on subsequent frames.
        private const val INITIAL_SYNC_SECTIONS: Int = 2
        // Scroll past this many dp on the category strip triggers the
        // one-way pill collapse. Small enough that the user just nudging
        // the strip counts; large enough that fingers casually grazing
        // the strip don't accidentally collapse it.
        private const val COLLAPSE_TRIGGER_DP: Float = 12f
        // Matches `EchosKeyboardView.LONG_PRESS_THRESHOLD_MS` (400ms) so
        // the picker's skin-tone popup opens on the same dwell time as
        // the letter keyboard's accent picker.
        private const val LONG_PRESS_THRESHOLD_MS: Long = 400L
    }
}
