import UIKit

protocol EmojiPickerViewDelegate: AnyObject {
    func emojiPicker(_ view: EmojiPickerView, didSelect emoji: String)
    /// A grid cell went pressed — `emoji` is the display (tone-applied)
    /// glyph and `frame` the cell's frame in the picker's coordinate space,
    /// so the owner can float a preview balloon above it.
    func emojiPicker(_ view: EmojiPickerView, didHighlight emoji: String, at frame: CGRect)
    func emojiPickerDidUnhighlight(_ view: EmojiPickerView)
    /// Long-press on a skin-tone-capable emoji. `base` is the untinted
    /// emoji the preference is keyed by.
    func emojiPicker(_ view: EmojiPickerView, didLongPressSkinTonable base: String, at frame: CGRect)
    func emojiPickerDidTapABC(_ view: EmojiPickerView)
    func emojiPickerDidTapDelete(_ view: EmojiPickerView)
    func emojiPickerDidHoldDeleteWord(_ view: EmojiPickerView)
    func emojiPickerDidActivateSearch(_ view: EmojiPickerView)
}

final class EmojiPickerView: UIView, UICollectionViewDataSource,
    UICollectionViewDelegate, UITextFieldDelegate, UIGestureRecognizerDelegate {

    weak var delegate: EmojiPickerViewDelegate?

    private let theme: KeyboardTheme

    private let searchContainer = UIView()
    private let searchField = UITextField()

    private var compositionalLayout: UICollectionViewCompositionalLayout!
    private let collectionView: UICollectionView

    private let bottomStripContainer = UIView()
    // Outer strip: [ABC] — gap — [category icons] — gap — [delete]. ABC/delete
    // are fixed-width so the gaps read as real margin; the category icons live
    // in `categoryStack` and fill the middle equally.
    private let bottomStrip = UIStackView()
    private let categoryStack = UIStackView()
    private let abcButton = StripTextButton(text: "ABC")
    private let deleteButton = StripDeleteButton()
    private var categoryButtons: [StripIconButton] = []

    private var visibleCategories: [EmojiCategory] = []
    // Tracks the category set the bottom strip's buttons were built for,
    // so refreshRecents() can skip the strip rebuild when the set hasn't
    // actually changed (the common case — only the first ever emoji
    // pick or wiping recents shifts the set).
    private var lastBuiltStripCategories: [EmojiCategory] = []
    // Snapshot of the per-section emoji lists. Reading from the live
    // EmojiData.emojis(for:) between taps would race with RecentEmojis
    // reordering and insert a different emoji than the user tapped.
    private var sectionData: [[String]] = []
    private var currentCategoryIndex: Int = 0
    // Set while scrollToItem animates a category tap; suppresses the
    // scrollViewDidScroll callbacks that would otherwise revert the
    // highlight to the section being scrolled away from.
    private var isAnimatingProgrammaticScroll: Bool = false

    // Opens the skin-tone popover on the hand/finger emojis. Gated in
    // `gestureRecognizerShouldBegin` so presses on non-tonable emojis are
    // never cancelled and keep their normal tap flow.
    private var skinToneLongPress: UILongPressGestureRecognizer!

    // Slide-to-browse: a zero-duration long-press over the category section
    // lets the user press and drag a finger across the icons, moving through
    // categories continuously (with a selection haptic per crossing) and
    // committing wherever the finger lifts — matching native iOS. A plain tap
    // is the same gesture with no drag, so the category buttons themselves are
    // rendered non-interactive and this gesture owns every category touch.
    private var categoryScrubGesture: UILongPressGestureRecognizer!
    // Track drawn behind the category icons while a scrub is in progress.
    private let categoryScrubBackground = UIView()
    private var isScrubbing = false
    // Where the current press started, and whether the finger has moved past
    // the slop that turns a tap into a scrub. The track only appears once a
    // scrub is under way — a plain tap must not flash it.
    private var scrubStartX: CGFloat = 0
    private static let scrubActivationSlop: CGFloat = 6
    // Caps the category-icon cluster width so the icons don't spread across
    // the full (wide) landscape strip; only binds in landscape. Constant is
    // refreshed per rebuild since it scales with the category count.
    private var categoryWidthCap: NSLayoutConstraint?
    // Per-icon cell width the landscape cluster is capped at. Wide enough that
    // the icons sit evenly with generous spacing (more than portrait), while
    // the wide landscape strip still leaves a large margin to ABC/back.
    private static let maxCategoryCellWidth: CGFloat = 60
    // Minimum margin between ABC/back and the icon cluster. Landscape keeps a
    // wide margin (the cluster is centered); portrait drops it to ~0 so the
    // icons spread across the full width like the original layout.
    private var categorySpacerMin: NSLayoutConstraint?
    private static let categorySpacerMinLandscape: CGFloat = 14
    private static let categorySpacerMinPortrait: CGFloat = 6
    // Gap between the search bar and the grid. Landscape tightens it so the
    // rows sit higher (freeing room for the taller landscape cells).
    private var gridTopGap: NSLayoutConstraint?
    private static let gridTopGapLandscape: CGFloat = 2

    private static let searchBarHeight: CGFloat = 40
    private static let stripHeight: CGFloat = 38
    private static let searchBarPadding: CGFloat = 8
    private static let cellSpacing: CGFloat = 2

    init(theme: KeyboardTheme) {
        self.theme = theme

        // Initialise with a placeholder layout — `setupView` builds the
        // real compositional layout once the instance is fully constructed
        // (the layout closure needs `self`).
        self.collectionView = UICollectionView(
            frame: .zero, collectionViewLayout: UICollectionViewFlowLayout()
        )

        super.init(frame: .zero)
        setupView()
        rebuildCategories()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    // MARK: - Setup

    private func setupView() {
        backgroundColor = .clear

        // ---- Search field (top) ----
        searchContainer.translatesAutoresizingMaskIntoConstraints = false
        addSubview(searchContainer)

        searchField.translatesAutoresizingMaskIntoConstraints = false
        // Placeholder colored to match the search overlay's placeholder so
        // the field reads identically before vs after tap (the overlay
        // replaces this field 1:1 in `.emojiSearch`).
        searchField.attributedPlaceholder = NSAttributedString(
            string: "Search Emoji",
            attributes: [.foregroundColor: theme.emojiCategoryInactiveTint]
        )
        searchField.font = .systemFont(ofSize: 16)
        // Slightly darker than the category-pill fill — native iOS uses
        // a more recessed look for the search field so it reads as the
        // primary input affordance.
        searchField.backgroundColor = theme.emojiSearchBarFill
        searchField.layer.cornerRadius = EmojiPickerView.searchBarHeight / 2
        searchField.layer.cornerCurve = .continuous
        searchField.borderStyle = .none
        searchField.returnKeyType = .search
        searchField.delegate = self
        searchField.clearButtonMode = .whileEditing
        searchField.autocorrectionType = .no
        searchField.autocapitalizationType = .none

        // Magnifying glass on the left to match native. Sized at 18pt
        // SF Symbol with a 10pt leading inset so the field feels generous
        // like the system emoji search bar.
        let glassConfig = UIImage.SymbolConfiguration(pointSize: 16, weight: .regular)
        let glass = UIImageView(
            image: UIImage(systemName: "magnifyingglass", withConfiguration: glassConfig)
        )
        glass.tintColor = theme.emojiCategoryInactiveTint
        glass.contentMode = .scaleAspectFit
        let leftView = UIView(frame: CGRect(x: 0, y: 0, width: 36, height: 24))
        glass.frame = CGRect(x: 10, y: 0, width: 20, height: 24)
        leftView.addSubview(glass)
        searchField.leftView = leftView
        searchField.leftViewMode = .always

        searchContainer.addSubview(searchField)

        // ---- Collection view (middle) ----
        compositionalLayout = makeCompositionalLayout()
        collectionView.collectionViewLayout = compositionalLayout
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.backgroundColor = .clear
        collectionView.register(EmojiCell.self, forCellWithReuseIdentifier: EmojiCell.reuseId)
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.showsHorizontalScrollIndicator = false
        collectionView.showsVerticalScrollIndicator = false
        collectionView.alwaysBounceHorizontal = true
        addSubview(collectionView)

        skinToneLongPress = UILongPressGestureRecognizer(
            target: self, action: #selector(handleSkinToneLongPress(_:))
        )
        skinToneLongPress.minimumPressDuration = 0.4
        skinToneLongPress.delegate = self
        collectionView.addGestureRecognizer(skinToneLongPress)

        // ---- Bottom strip ----
        bottomStripContainer.translatesAutoresizingMaskIntoConstraints = false
        addSubview(bottomStripContainer)

        // Sits behind the strip; frame is set per-scrub to span the category
        // icon region. Hidden (alpha 0) until a scrub begins.
        categoryScrubBackground.isUserInteractionEnabled = false
        categoryScrubBackground.backgroundColor = theme.emojiCategoryScrubTrack
        categoryScrubBackground.layer.cornerCurve = .continuous
        categoryScrubBackground.alpha = 0
        bottomStripContainer.addSubview(categoryScrubBackground)

        // Layout: [ABC][spacer][category icons][spacer][delete]. The equal
        // spacers center the icon cluster and provide the ≥14pt margin to
        // ABC/delete; `categoryWidthCap` keeps the cluster from stretching
        // across a wide (landscape) strip so the icons stay close together.
        bottomStrip.axis = .horizontal
        bottomStrip.alignment = .fill
        bottomStrip.distribution = .fill
        bottomStrip.spacing = 0
        bottomStrip.translatesAutoresizingMaskIntoConstraints = false
        bottomStripContainer.addSubview(bottomStrip)

        categoryStack.axis = .horizontal
        categoryStack.alignment = .fill
        categoryStack.distribution = .fillEqually
        // Explicit, even gap between the category icons — the same value in
        // both orientations so they never read as touching.
        categoryStack.spacing = 8
        categoryStack.setContentHuggingPriority(.defaultLow, for: .horizontal)

        abcButton.theme = theme
        abcButton.addTarget(self, action: #selector(handleABCTap), for: .touchUpInside)

        deleteButton.theme = theme
        deleteButton.onDelete = { [weak self] in
            guard let self = self else { return }
            self.delegate?.emojiPickerDidTapDelete(self)
        }
        deleteButton.onDeleteWord = { [weak self] in
            guard let self = self else { return }
            self.delegate?.emojiPickerDidHoldDeleteWord(self)
        }

        // Fixed structure — only `categoryStack`'s contents change on rebuild.
        // ABC/delete are a fixed width; the spacers (high hugging, so they
        // stay at their 14pt minimum until the cap forces the cluster narrow)
        // provide the margin and centering.
        let leftSpacer = UIView()
        let rightSpacer = UIView()
        for spacer in [leftSpacer, rightSpacer] {
            spacer.isUserInteractionEnabled = false
            spacer.setContentHuggingPriority(.defaultHigh, for: .horizontal)
        }
        bottomStrip.addArrangedSubview(abcButton)
        bottomStrip.addArrangedSubview(leftSpacer)
        bottomStrip.addArrangedSubview(categoryStack)
        bottomStrip.addArrangedSubview(rightSpacer)
        bottomStrip.addArrangedSubview(deleteButton)
        let cap = categoryStack.widthAnchor.constraint(lessThanOrEqualToConstant: 9999)
        categoryWidthCap = cap
        let spacerMin = leftSpacer.widthAnchor.constraint(
            greaterThanOrEqualToConstant: EmojiPickerView.categorySpacerMinLandscape
        )
        categorySpacerMin = spacerMin
        NSLayoutConstraint.activate([
            abcButton.widthAnchor.constraint(equalToConstant: 34),
            deleteButton.widthAnchor.constraint(equalToConstant: 34),
            leftSpacer.widthAnchor.constraint(equalTo: rightSpacer.widthAnchor),
            spacerMin,
        ])

        // The scrub gesture only needs the category area; attaching it to
        // `categoryStack` keeps ABC/delete taps flowing to their own buttons.
        categoryScrubGesture = UILongPressGestureRecognizer(
            target: self, action: #selector(handleCategoryScrub(_:))
        )
        categoryScrubGesture.minimumPressDuration = 0
        categoryScrubGesture.delegate = self
        categoryStack.addGestureRecognizer(categoryScrubGesture)

        let gridTop = collectionView.topAnchor.constraint(
            equalTo: searchContainer.bottomAnchor, constant: EmojiPickerView.searchBarPadding
        )
        gridTopGap = gridTop

        NSLayoutConstraint.activate([
            // 8pt padding around the search field — matches native iOS.
            searchContainer.leadingAnchor.constraint(equalTo: leadingAnchor, constant: EmojiPickerView.searchBarPadding),
            searchContainer.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -EmojiPickerView.searchBarPadding),
            // +2 over the standard pad drops the search bar (and the grid
            // below it) a touch lower, tightening the gap down to the strip.
            searchContainer.topAnchor.constraint(equalTo: topAnchor, constant: EmojiPickerView.searchBarPadding + 2),
            searchContainer.heightAnchor.constraint(equalToConstant: EmojiPickerView.searchBarHeight),

            searchField.leadingAnchor.constraint(equalTo: searchContainer.leadingAnchor),
            searchField.trailingAnchor.constraint(equalTo: searchContainer.trailingAnchor),
            searchField.topAnchor.constraint(equalTo: searchContainer.topAnchor),
            searchField.bottomAnchor.constraint(equalTo: searchContainer.bottomAnchor),

            collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            gridTop,
            collectionView.bottomAnchor.constraint(equalTo: bottomStripContainer.topAnchor),

            bottomStripContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
            bottomStripContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
            bottomStripContainer.bottomAnchor.constraint(equalTo: bottomAnchor),
            bottomStripContainer.heightAnchor.constraint(equalToConstant: EmojiPickerView.stripHeight),

            bottomStrip.leadingAnchor.constraint(equalTo: bottomStripContainer.leadingAnchor, constant: 4),
            bottomStrip.trailingAnchor.constraint(equalTo: bottomStripContainer.trailingAnchor, constant: -4),
            bottomStrip.topAnchor.constraint(equalTo: bottomStripContainer.topAnchor),
            bottomStrip.bottomAnchor.constraint(equalTo: bottomStripContainer.bottomAnchor),
        ])

        // Apply orientation-specific constants now that every toggled
        // constraint (cap, spacer min, grid-top gap) has been created.
        applyStripOrientation()
    }

    private func makeCompositionalLayout() -> UICollectionViewCompositionalLayout {
        let layout = UICollectionViewCompositionalLayout { [weak self] _, env in
            guard let self = self else { return nil }

            let isCompact = self.traitCollection.verticalSizeClass == .compact
            let rowCount = isCompact ? 3 : 4
            // Landscape opens the inter-emoji gaps up (wide screen has room):
            // columns +6 pt, rows a further +2 pt on top of that.
            let colSpacing = EmojiPickerView.cellSpacing + (isCompact ? 7 : 0)
            let rowSpacing: CGFloat = isCompact ? 10 : (colSpacing - 1)
            // Vertical top/bottom padding of the grid. Landscape keeps it and
            // centers the rows; portrait drops it to 0 and (below) piles the
            // slack above the grid, so the rows sit low — more gap under the
            // search bar, less above the category strip.
            let outerPad: CGFloat = isCompact ? EmojiPickerView.cellSpacing : 0
            let interGaps = CGFloat(rowCount - 1)
            // Cap prevents cellH from absorbing all leftover vertical space —
            // without it, reducing cellSpacing just inflates cell padding and
            // the visible gap doesn't change.
            let maxCellSize: CGFloat = 52
            let containerH = env.container.effectiveContentSize.height
            let usableH = max(80, containerH - interGaps * rowSpacing - 2 * outerPad)
            let cellH = min(floor(usableH / CGFloat(rowCount)), maxCellSize)
            let cellSide = cellH

            let itemSize = NSCollectionLayoutSize(
                widthDimension: .absolute(cellSide),
                heightDimension: .absolute(cellH)
            )
            let item = NSCollectionLayoutItem(layoutSize: itemSize)

            let groupHeight = cellH * CGFloat(rowCount) + rowSpacing * interGaps
            let groupSize = NSCollectionLayoutSize(
                widthDimension: .absolute(cellSide),
                heightDimension: .absolute(groupHeight)
            )
            let group = NSCollectionLayoutGroup.vertical(
                layoutSize: groupSize, subitem: item, count: rowCount
            )
            group.interItemSpacing = .fixed(rowSpacing)

            let baseTopBottom = outerPad
            let usedH = groupHeight + 2 * baseTopBottom
            let leftover = max(0, containerH - usedH)
            let extraTop: CGFloat
            let extraBottom: CGFloat
            if isCompact {
                extraTop = floor(leftover / 2)
                extraBottom = leftover - extraTop
            } else {
                // Portrait: pile the slack above the grid so the rows sit low
                // (touching the strip) — grows the gap under the search bar and
                // shrinks the gap above the category strip.
                extraTop = leftover
                extraBottom = 0
            }

            // Landscape sits the block 2pt higher (shifts top inset → bottom)
            // so the last row clears the category strip by as much as the top
            // row clears the search bar — the inter-row gaps are already equal.
            let upShift: CGFloat = isCompact ? 2 : 0
            let section = NSCollectionLayoutSection(group: group)
            section.interGroupSpacing = colSpacing
            section.contentInsets = NSDirectionalEdgeInsets(
                top: max(0, baseTopBottom + extraTop - upShift),
                leading: colSpacing / 2,
                bottom: baseTopBottom + extraBottom + upShift,
                trailing: colSpacing / 2
            )
            return section
        }

        let config = UICollectionViewCompositionalLayoutConfiguration()
        config.scrollDirection = .horizontal
        layout.configuration = config
        return layout
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Cell sizes depend on bounds.height; invalidate so the layout
        // closure runs again with the new height (e.g. orientation change).
        compositionalLayout.invalidateLayout()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if traitCollection.verticalSizeClass != previousTraitCollection?.verticalSizeClass {
            applyStripOrientation()
        }
    }

    /// Landscape clusters the category icons (width-capped, wide ABC/back
    /// margin); portrait lets them spread across the full strip with almost no
    /// margin, matching the original portrait layout. Only the landscape
    /// tuning changed last time — this keeps it out of portrait.
    private func applyStripOrientation() {
        let isLandscape = traitCollection.verticalSizeClass == .compact
        categoryWidthCap?.isActive = isLandscape
        categorySpacerMin?.constant = isLandscape
            ? EmojiPickerView.categorySpacerMinLandscape
            : EmojiPickerView.categorySpacerMinPortrait
        gridTopGap?.constant = isLandscape
            ? EmojiPickerView.gridTopGapLandscape
            : EmojiPickerView.searchBarPadding
    }

    func refreshRecents() {
        rebuildCategories()
    }

    /// Re-renders the visible cells after a skin-tone change. Offscreen
    /// cells pick the new tone up on dequeue, so no full reload (which
    /// would also reset the category highlight) is needed.
    func refreshSkinTones() {
        let visible = collectionView.indexPathsForVisibleItems
        guard !visible.isEmpty else { return }
        UIView.performWithoutAnimation {
            collectionView.reloadItems(at: visible)
        }
    }

    // MARK: - Categories

    private func rebuildCategories() {
        let recents = EmojiData.emojis(for: .recents)
        var cats: [EmojiCategory] = []
        if !recents.isEmpty { cats.append(.recents) }
        cats.append(contentsOf: EmojiCategory.allCases.filter { $0 != .recents })
        visibleCategories = cats
        sectionData = cats.map { EmojiData.emojis(for: $0) }
        if cats != lastBuiltStripCategories {
            rebuildCategoryStrip()
            lastBuiltStripCategories = cats
        }
        collectionView.reloadData()
        currentCategoryIndex = 0
        updateCategorySelection()
    }

    private func rebuildCategoryStrip() {
        // The outer strip (ABC / categoryStack / delete) is fixed; only the
        // category icons inside `categoryStack` change.
        for view in categoryStack.arrangedSubviews {
            categoryStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        categoryButtons.removeAll()

        // One button per visible category. These are visual-only —
        // `categoryScrubGesture` owns all category touches (tap + slide), so
        // they don't do their own hit-testing (which would race the gesture).
        for (idx, cat) in visibleCategories.enumerated() {
            let btn = StripIconButton(symbolName: cat.symbolName, theme: theme)
            btn.accessibilityLabel = cat.displayName
            btn.tag = idx
            btn.isUserInteractionEnabled = false
            categoryStack.addArrangedSubview(btn)
            categoryButtons.append(btn)
        }

        // Cap the cluster at ~one native cell per icon so a wide landscape
        // strip doesn't fan the icons apart; portrait stays under the cap and
        // fills normally.
        categoryWidthCap?.constant =
            CGFloat(categoryButtons.count) * EmojiPickerView.maxCategoryCellWidth

        // Trailing: delete.
        bottomStrip.addArrangedSubview(deleteButton)
    }

    private func updateCategorySelection() {
        for (idx, btn) in categoryButtons.enumerated() {
            btn.setSelected(idx == currentCategoryIndex)
        }
    }

    // MARK: - Category scrubbing

    @objc private func handleCategoryScrub(_ gr: UILongPressGestureRecognizer) {
        let x = gr.location(in: bottomStrip).x
        switch gr.state {
        case .began:
            // A press alone must not render the track — only a genuine slide
            // does (see `.changed`). The tapped category is still selected.
            scrubStartX = x
            selectCategory(atStripX: x)
        case .changed:
            // Once the finger shifts past the slop, promote to a scrub: reveal
            // the track and clear the per-icon pill so it doesn't "hover" from
            // icon to icon as the finger moves.
            if !isScrubbing,
               abs(x - scrubStartX) > EmojiPickerView.scrubActivationSlop {
                setScrubBackground(visible: true)
                for btn in categoryButtons { btn.setSelected(false) }
            }
            selectCategory(atStripX: x)
        case .ended, .cancelled, .failed:
            setScrubBackground(visible: false)
            updateCategorySelection()
        default:
            break
        }
    }

    /// Selects the category whose icon the finger is over (clamping to the end
    /// icons when the finger runs off either side), jumping to it instantly and
    /// firing a selection haptic on each crossing. No-op when the target is
    /// already active, so a tap or a stationary press ticks only once. The
    /// per-icon pill is deliberately not updated here — it's applied only when
    /// the scrub ends (see `handleCategoryScrub`).
    private func selectCategory(atStripX x: CGFloat) {
        guard !categoryButtons.isEmpty else { return }
        var target = categoryButtons.count - 1
        for (idx, btn) in categoryButtons.enumerated() {
            let frame = btn.convert(btn.bounds, to: bottomStrip)
            if x <= frame.maxX { target = idx; break }
        }
        guard target != currentCategoryIndex, target < visibleCategories.count else { return }
        currentCategoryIndex = target
        HapticManager.selectionChanged()
        guard collectionView.numberOfItems(inSection: target) > 0 else { return }
        // Jump — never animate — so a different set's emojis are shown at once
        // instead of spinning the grid past every category in between.
        isAnimatingProgrammaticScroll = true
        collectionView.scrollToItem(
            at: IndexPath(item: 0, section: target), at: .left, animated: false
        )
    }

    private func setScrubBackground(visible: Bool) {
        guard isScrubbing != visible else { return }
        isScrubbing = visible
        if visible, let region = categoryRegion(in: bottomStripContainer) {
            let track = region.insetBy(dx: -4, dy: 3)
            categoryScrubBackground.frame = track
            categoryScrubBackground.layer.cornerRadius = track.height / 2
        }
        UIView.animate(withDuration: 0.15) {
            self.categoryScrubBackground.alpha = visible ? 1 : 0
        }
    }

    /// Bounding rect of the category-icon run (first icon's leading edge to the
    /// last icon's trailing edge), expressed in `target`'s coordinate space.
    private func categoryRegion(in target: UIView) -> CGRect? {
        guard let first = categoryButtons.first,
              let last = categoryButtons.last else { return nil }
        let f = first.convert(first.bounds, to: target)
        let l = last.convert(last.bounds, to: target)
        return CGRect(x: f.minX, y: f.minY, width: l.maxX - f.minX, height: f.height)
    }

    @objc private func handleABCTap() {
        KeyFeedback.keyTap(.modifier)
        delegate?.emojiPickerDidTapABC(self)
    }

    // MARK: - UICollectionViewDataSource

    func numberOfSections(in collectionView: UICollectionView) -> Int {
        return visibleCategories.count
    }

    func collectionView(
        _ collectionView: UICollectionView,
        numberOfItemsInSection section: Int
    ) -> Int {
        return sectionData[section].count
    }

    func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: EmojiCell.reuseId,
            for: indexPath
        ) as! EmojiCell
        cell.configure(
            with: SkinTonePreferences.shared.display(base(at: indexPath) ?? ""),
            theme: theme
        )
        return cell
    }

    /// The untinted base emoji at `indexPath`, or nil if the path is stale.
    /// Centralizes the section/item bounds check every tap / highlight /
    /// long-press path needs, so the `sectionData` shape is asserted once.
    private func base(at indexPath: IndexPath) -> String? {
        guard indexPath.section < sectionData.count,
              indexPath.item < sectionData[indexPath.section].count else { return nil }
        return sectionData[indexPath.section][indexPath.item]
    }

    // MARK: - UICollectionViewDelegate

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        guard let emoji = base(at: indexPath) else { return }
        RecentEmojis.shared.record(emoji)
        delegate?.emojiPicker(self, didSelect: emoji)
        KeyFeedback.keyTap()
        collectionView.deselectItem(at: indexPath, animated: false)
    }

    func collectionView(_ collectionView: UICollectionView, didHighlightItemAt indexPath: IndexPath) {
        guard let emoji = base(at: indexPath),
              let cell = collectionView.cellForItem(at: indexPath) else { return }
        delegate?.emojiPicker(
            self, didHighlight: SkinTonePreferences.shared.display(emoji),
            at: cell.convert(cell.bounds, to: self)
        )
    }

    func collectionView(_ collectionView: UICollectionView, didUnhighlightItemAt indexPath: IndexPath) {
        delegate?.emojiPickerDidUnhighlight(self)
    }

    // MARK: - Skin tone long-press

    @objc private func handleSkinToneLongPress(_ gr: UILongPressGestureRecognizer) {
        guard gr.state == .began,
              let indexPath = collectionView.indexPathForItem(at: gr.location(in: collectionView)),
              let base = base(at: indexPath),
              let cell = collectionView.cellForItem(at: indexPath) else { return }
        // Recognition cancels the collection view's touches, so the cell
        // unhighlights (hiding the balloon) and never commits a select —
        // which also means the press produced no feedback of its own yet.
        HapticManager.keyTap()
        delegate?.emojiPicker(
            self, didLongPressSkinTonable: base,
            at: cell.convert(cell.bounds, to: self)
        )
    }

    // UIView already declares this (for gestures attached to the view
    // itself), hence the `override`; the same method doubles as our
    // UIGestureRecognizerDelegate conformance for the collection view's
    // long-press.
    override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        if gestureRecognizer === categoryScrubGesture {
            // The gesture is bound to `categoryStack`, so it already only sees
            // icon-area touches; this guards the degenerate no-categories case.
            guard let region = categoryRegion(in: bottomStrip) else { return false }
            return region.contains(gestureRecognizer.location(in: bottomStrip))
        }
        guard gestureRecognizer === skinToneLongPress else {
            return super.gestureRecognizerShouldBegin(gestureRecognizer)
        }
        guard let indexPath = collectionView.indexPathForItem(
            at: gestureRecognizer.location(in: collectionView)
        ), let base = base(at: indexPath) else { return false }
        return EmojiSkinTones.supports(base)
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard scrollView === collectionView, !isAnimatingProgrammaticScroll else { return }
        // Active category tracks the leftmost visible section.
        let visibleSections = collectionView.indexPathsForVisibleItems.map(\.section)
        guard let leftSection = visibleSections.min() else { return }
        if leftSection != currentCategoryIndex {
            currentCategoryIndex = leftSection
            updateCategorySelection()
        }
    }

    func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
        guard scrollView === collectionView else { return }
        isAnimatingProgrammaticScroll = false
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        // User-driven drag mid-animation — clear the flag so scroll callbacks
        // can update the active category again.
        guard scrollView === collectionView else { return }
        isAnimatingProgrammaticScroll = false
    }

    // MARK: - UITextFieldDelegate

    // The search field is never actually focused — the picker hands the tap
    // to KeyboardView which switches into .emojiSearch instead.
    func textFieldShouldBeginEditing(_ textField: UITextField) -> Bool {
        KeyFeedback.keyTap(.modifier)
        delegate?.emojiPickerDidActivateSearch(self)
        return false
    }
}

// MARK: - Bottom strip buttons

private final class StripTextButton: UIButton {
    var theme: KeyboardTheme = KeyboardTheme() {
        didSet { applyColors() }
    }

    init(text: String) {
        super.init(frame: .zero)
        setTitle(text, for: .normal)
        titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
        applyColors()
    }

    required init?(coder: NSCoder) { fatalError() }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyColors()
    }

    private func applyColors() {
        // Same tint as the category icons (full label color), so ABC reads as
        // part of the same row of controls rather than a distinct affordance.
        setTitleColor(theme.keyText, for: .normal)
        setTitleColor(theme.keyText.withAlphaComponent(0.6), for: .highlighted)
    }
}

private final class StripIconButton: UIButton {
    private var isSelectedState = false
    private let theme: KeyboardTheme
    private let pill = UIView()

    init(symbolName: String, theme: KeyboardTheme) {
        self.theme = theme
        super.init(frame: .zero)
        let cfg = UIImage.SymbolConfiguration(pointSize: 16, weight: .regular)
        setImage(
            UIImage(systemName: symbolName, withConfiguration: cfg),
            for: .normal
        )
        adjustsImageWhenHighlighted = false
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.isUserInteractionEnabled = false
        pill.layer.cornerRadius = 12
        pill.layer.cornerCurve = .continuous
        pill.backgroundColor = .clear
        insertSubview(pill, at: 0)
        NSLayoutConstraint.activate([
            pill.centerXAnchor.constraint(equalTo: centerXAnchor),
            pill.centerYAnchor.constraint(equalTo: centerYAnchor),
            pill.widthAnchor.constraint(equalToConstant: 24),
            pill.heightAnchor.constraint(equalToConstant: 24),
        ])
        applyColors()
    }

    required init?(coder: NSCoder) { fatalError() }

    func setSelected(_ s: Bool) {
        isSelectedState = s
        applyColors()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyColors()
    }

    private func applyColors() {
        // Glyph is always the full label tint (black in light, white in dark);
        // the selection is shown purely by the pill, never by dimming the icon.
        tintColor = theme.keyText
        pill.backgroundColor = isSelectedState
            ? theme.emojiCategorySelectedFill
            : .clear
    }
}

// Delete state machine lives in DeleteRepeater (shared with KeyboardView).
private final class StripDeleteButton: UIButton {
    var theme: KeyboardTheme = KeyboardTheme() {
        didSet { applyColors() }
    }
    var onDelete: (() -> Void)?
    var onDeleteWord: (() -> Void)?

    private let repeater = DeleteRepeater()

    init() {
        super.init(frame: .zero)
        let cfg = UIImage.SymbolConfiguration(pointSize: 16, weight: .regular)
        setImage(
            UIImage(systemName: "delete.left", withConfiguration: cfg),
            for: .normal
        )
        // Dim the glyph while held for press feedback (no background tile).
        adjustsImageWhenHighlighted = true
        // Each repeat clicks like the native delete key; the initial press
        // (handleDown) supplies the haptic, so repeats stay sound-only.
        repeater.onCharRepeat = { [weak self] in
            SoundManager.deleteTap()
            self?.onDelete?()
        }
        repeater.onWordRepeat = { [weak self] in
            SoundManager.deleteTap()
            self?.onDeleteWord?()
        }
        addTarget(self, action: #selector(handleDown), for: .touchDown)
        addTarget(self, action: #selector(handleUp), for: [.touchUpInside])
        addTarget(self, action: #selector(handleCancel),
                  for: [.touchUpOutside, .touchCancel, .touchDragOutside])
        applyColors()
    }

    required init?(coder: NSCoder) { fatalError() }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyColors()
    }

    private func applyColors() {
        // Same tint as the category icons (full label color).
        tintColor = theme.keyText
    }

    @objc private func handleDown() {
        KeyFeedback.keyTap(.delete)
        repeater.start()
    }

    @objc private func handleUp() {
        let suppressTap = repeater.didRepeat
        repeater.stop()
        if !suppressTap { onDelete?() }
    }

    @objc private func handleCancel() {
        repeater.stop()
    }
}

// MARK: - Cell

private final class EmojiCell: UICollectionViewCell {
    static let reuseId = "EmojiCell"

    private let label = UILabel()
    private let highlightView = UIView()
    private var theme = KeyboardTheme()
    private var lastGlyphHeight: CGFloat = 0

    override init(frame: CGRect) {
        super.init(frame: frame)

        highlightView.translatesAutoresizingMaskIntoConstraints = false
        highlightView.isUserInteractionEnabled = false
        highlightView.alpha = 0
        highlightView.layer.cornerRadius = 6
        highlightView.layer.cornerCurve = .continuous
        contentView.addSubview(highlightView)

        label.translatesAutoresizingMaskIntoConstraints = false
        label.textAlignment = .center
        contentView.addSubview(label)

        NSLayoutConstraint.activate([
            highlightView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 2),
            highlightView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -2),
            highlightView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 2),
            highlightView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -2),

            label.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Glyph scales with the cell. Portrait's 0.75 ratio keeps native-sized
        // ~39pt emojis in 52pt cells with tight gaps; landscape cells are much
        // shorter, so a larger ratio is used there to render the emojis ~4pt
        // bigger (they read as undersized otherwise). Only rebuild the font
        // when the cell height changes — layoutSubviews fires repeatedly and
        // reassigning the font re-lays out the label each time.
        guard bounds.height != lastGlyphHeight else { return }
        lastGlyphHeight = bounds.height
        let ratio: CGFloat = traitCollection.verticalSizeClass == .compact ? 0.88 : 0.75
        label.font = .systemFont(ofSize: floor(bounds.height * ratio))
    }

    func configure(with emoji: String, theme: KeyboardTheme) {
        self.theme = theme
        label.text = emoji
        highlightView.backgroundColor = theme.emojiCellPressedFill
        highlightView.alpha = 0
        contentView.transform = .identity
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        highlightView.alpha = 0
        contentView.transform = .identity
        label.text = nil
    }

    override var isHighlighted: Bool {
        didSet {
            UIView.animate(
                withDuration: isHighlighted ? 0.05 : 0.18,
                delay: 0,
                options: [.beginFromCurrentState, .curveEaseOut],
                animations: {
                    self.highlightView.alpha = self.isHighlighted ? 1 : 0
                    self.contentView.transform = self.isHighlighted
                        ? CGAffineTransform(scaleX: 1.08, y: 1.08)
                        : .identity
                }
            )
        }
    }
}
