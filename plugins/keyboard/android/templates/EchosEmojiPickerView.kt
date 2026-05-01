package com.a1lab.echos.ime

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.AbsListView
import android.widget.BaseAdapter
import android.widget.GridView
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * In-IME emoji picker. Shown when the user taps the smiley key — Android
 * doesn't expose any way for a third-party IME to programmatically jump to
 * the system Emoji panel, so we render our own (the same approach Gboard /
 * SwiftKey take).
 *
 * Layout (vertical):
 *   - Category strip (HorizontalScrollView, one icon per category)
 *   - Emoji grid (`GridView`, 9 columns) — uses the built-in recycling
 *     adapter so we avoid pulling in a new compile dependency
 *   - Bottom bar (ABC | space | delete) with width ratios mirroring the
 *     regular keyboard's bottom row (1.5 : 5 : 1.5).
 */
class EchosEmojiPickerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : LinearLayout(context, attrs) {

    interface Listener {
        fun onEmojiSelected(emoji: String)
        fun onBackToLetters()
        fun onSpacePressed()
        fun onDeleteCharacter()
        fun onDeleteWord()
    }

    private val theme = KeyTheme(context)
    private var listener: Listener? = null

    private val categoryStripScroll: HorizontalScrollView
    private val categoryStripStack: LinearLayout
    private val gridView: GridView
    private val abcButton: TextView
    private val spaceButton: TextView
    private val deleteButton: TextView

    private val categoryButtons = mutableListOf<TextView>()
    private val visibleCategories = mutableListOf<EmojiCategory>()
    /** Snapshot per category, captured at refresh time so taps never race
     *  recents reordering. */
    private val sectionData = mutableListOf<List<String>>()
    /** Position in the flattened emoji list where each category begins. */
    private val sectionStartPositions = mutableListOf<Int>()
    private val flatEmojis = mutableListOf<String>()
    private var currentCategoryIndex = 0
    private var suppressScrollUpdates = false

    private val deleteRepeater = KeyDeleteRepeater(
        onCharDelete = { listener?.onDeleteCharacter() },
        onWordDelete = { listener?.onDeleteWord() },
    )

    private val adapter = EmojiAdapter()

    init {
        orientation = VERTICAL
        setBackgroundColor(theme.keyboardBackground)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        categoryStripScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                dp(36f).toInt(),
            )
        }
        categoryStripStack = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
        categoryStripScroll.addView(categoryStripStack)
        addView(categoryStripScroll)

        gridView = GridView(context).apply {
            numColumns = GRID_COLUMNS
            verticalSpacing = dp(2f).toInt()
            horizontalSpacing = dp(2f).toInt()
            stretchMode = GridView.STRETCH_COLUMN_WIDTH
            isVerticalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            adapter = this@EchosEmojiPickerView.adapter
            setPadding(dp(4f).toInt(), dp(2f).toInt(), dp(4f).toInt(), dp(2f).toInt())
            // Picker total height matches the regular keyboard's 4-row layout
            // (224dp = 4 × 46dp + 3 × 8dp + 8dp top + 8dp bottom). After
            // subtracting categoryStrip (36dp), bottom bar (48dp), and the
            // bar's 6dp padding, the grid gets 134dp — exactly 3 rows of
            // 40dp cells with 2dp vertical spacing.
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(134f).toInt())
            setOnItemClickListener { _, _, position, _ ->
                if (position !in flatEmojis.indices) return@setOnItemClickListener
                val emoji = flatEmojis[position]
                performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                RecentEmojis.record(this@EchosEmojiPickerView.context, emoji)
                listener?.onEmojiSelected(emoji)
            }
            setOnScrollListener(object : AbsListView.OnScrollListener {
                override fun onScrollStateChanged(view: AbsListView?, scrollState: Int) = Unit
                override fun onScroll(
                    view: AbsListView?,
                    firstVisibleItem: Int,
                    visibleItemCount: Int,
                    totalItemCount: Int,
                ) {
                    if (suppressScrollUpdates) return
                    if (firstVisibleItem < 0) return
                    updateCategoryFromPosition(firstVisibleItem)
                }
            })
        }
        addView(gridView)

        // Bottom bar — width ratios match the regular keyboard's bottom row
        // (ABC : space : delete = 1.5 : 5 : 1.5) so the spacebar fills the
        // gap between the two pill keys.
        val bottomBar = LinearLayout(context).apply {
            orientation = HORIZONTAL
            weightSum = 8f
            val padH = dp(4f).toInt()
            setPadding(padH, dp(2f).toInt(), padH, dp(4f).toInt())
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(48f).toInt())
        }
        abcButton = makeKeyButton(
            text = "ABC",
            textSize = 14f,
            contentDesc = "Letters",
            weight = 1.5f,
        )
        spaceButton = makeKeyButton(
            text = "space",
            textSize = 14f,
            contentDesc = "Space",
            weight = 5f,
        )
        deleteButton = makeKeyButton(
            text = "⌫",
            textSize = 18f,
            contentDesc = "Delete",
            weight = 1.5f,
        )
        bottomBar.addView(abcButton)
        bottomBar.addView(spacer())
        bottomBar.addView(spaceButton)
        bottomBar.addView(spacer())
        bottomBar.addView(deleteButton)
        addView(bottomBar)

        wireBottomBar()
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
        // Recents is always pinned as the first tab — even when empty — so
        // users see where their picks will land. The grid for that section
        // stays empty until they tap their first emoji and reopen the picker.
        visibleCategories.clear()
        visibleCategories.add(EmojiCategory.RECENTS)
        visibleCategories.addAll(EmojiCategory.values().filter { it != EmojiCategory.RECENTS })

        sectionData.clear()
        sectionStartPositions.clear()
        flatEmojis.clear()
        for (cat in visibleCategories) {
            val list = EmojiData.emojis(cat, context)
            sectionData.add(list)
            sectionStartPositions.add(flatEmojis.size)
            flatEmojis.addAll(list)
        }

        rebuildCategoryButtons()
        adapter.notifyDataSetChanged()
        currentCategoryIndex = 0
        updateCategorySelection()
    }

    private fun rebuildCategoryButtons() {
        categoryStripStack.removeAllViews()
        categoryButtons.clear()
        for ((idx, cat) in visibleCategories.withIndex()) {
            val btn = TextView(context).apply {
                text = cat.symbolGlyph
                textSize = 18f
                gravity = Gravity.CENTER
                contentDescription = cat.displayName
                setPadding(dp(10f).toInt(), 0, dp(10f).toInt(), 0)
                isClickable = true
                isFocusable = true
                background = pressableTransparent()
                setOnClickListener { scrollToCategory(idx) }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.MATCH_PARENT,
                )
            }
            categoryStripStack.addView(btn)
            categoryButtons.add(btn)
        }
    }

    private fun updateCategorySelection() {
        for ((idx, btn) in categoryButtons.withIndex()) {
            btn.alpha = if (idx == currentCategoryIndex) 1f else 0.5f
        }
    }

    private fun scrollToCategory(idx: Int) {
        if (idx >= sectionStartPositions.size) return
        currentCategoryIndex = idx
        updateCategorySelection()
        suppressScrollUpdates = true
        gridView.setSelection(sectionStartPositions[idx])
        gridView.post { suppressScrollUpdates = false }
    }

    private fun updateCategoryFromPosition(position: Int) {
        var idx = 0
        for ((i, start) in sectionStartPositions.withIndex()) {
            if (position >= start) idx = i else break
        }
        if (idx != currentCategoryIndex) {
            currentCategoryIndex = idx
            updateCategorySelection()
        }
    }

    // MARK: - Bottom bar wiring

    @SuppressLint("ClickableViewAccessibility")
    private fun wireBottomBar() {
        abcButton.setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            listener?.onBackToLetters()
        }
        spaceButton.setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            listener?.onSpacePressed()
        }
        // Delete: support tap (single char) AND hold-to-repeat that escalates
        // to word-deletion past the threshold. We can't use OnClickListener
        // alone because the touch lifecycle drives the repeat timer.
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

    // MARK: - Adapter

    private inner class EmojiAdapter : BaseAdapter() {
        override fun getCount(): Int = flatEmojis.size
        override fun getItem(position: Int): Any = flatEmojis[position]
        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(
            position: Int,
            convertView: View?,
            parent: ViewGroup,
        ): View {
            val tv = (convertView as? TextView) ?: TextView(parent.context).apply {
                gravity = Gravity.CENTER
                textSize = 24f
                background = pressableTransparent()
                layoutParams = AbsListView.LayoutParams(
                    AbsListView.LayoutParams.MATCH_PARENT,
                    dp(40f).toInt(),
                )
            }
            tv.text = flatEmojis[position]
            return tv
        }
    }

    // MARK: - Helpers

    private fun spacer(): View {
        val v = View(context)
        v.layoutParams = LinearLayout.LayoutParams(dp(6f).toInt(), LayoutParams.MATCH_PARENT)
        return v
    }

    private fun makeKeyButton(
        text: String,
        textSize: Float,
        contentDesc: String,
        weight: Float,
    ): TextView {
        return TextView(context).apply {
            this.text = text
            this.textSize = textSize
            gravity = Gravity.CENTER
            setTextColor(theme.keyText)
            background = keyBackgroundDrawable()
            contentDescription = contentDesc
            isClickable = true
            isFocusable = true
            layoutParams = LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, weight)
        }
    }

    private fun keyBackgroundDrawable(): StateListDrawable {
        val cornerPx = dp(8f)
        val pressed = GradientDrawable().apply {
            cornerRadius = cornerPx
            setColor(theme.specialKeyBackgroundPressed)
        }
        val normal = GradientDrawable().apply {
            cornerRadius = cornerPx
            setColor(theme.specialKeyBackground)
        }
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), pressed)
            addState(intArrayOf(), normal)
        }
    }

    private fun pressableTransparent(): StateListDrawable {
        val cornerPx = dp(6f)
        val pressed = GradientDrawable().apply {
            cornerRadius = cornerPx
            setColor(theme.keyBackgroundPressed)
        }
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), pressed)
            addState(intArrayOf(), GradientDrawable().apply { cornerRadius = cornerPx })
        }
    }

    private fun dp(value: Float): Float =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics,
        )

    companion object {
        private const val GRID_COLUMNS = 9
    }
}
