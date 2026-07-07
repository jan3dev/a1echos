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
    private let bottomStrip = UIStackView()
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

        bottomStrip.axis = .horizontal
        bottomStrip.alignment = .fill
        bottomStrip.distribution = .fillEqually
        bottomStrip.spacing = 0
        bottomStrip.translatesAutoresizingMaskIntoConstraints = false
        bottomStripContainer.addSubview(bottomStrip)

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

        NSLayoutConstraint.activate([
            // 8pt padding around the search field — matches native iOS.
            searchContainer.leadingAnchor.constraint(equalTo: leadingAnchor, constant: EmojiPickerView.searchBarPadding),
            searchContainer.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -EmojiPickerView.searchBarPadding),
            searchContainer.topAnchor.constraint(equalTo: topAnchor, constant: EmojiPickerView.searchBarPadding),
            searchContainer.heightAnchor.constraint(equalToConstant: EmojiPickerView.searchBarHeight),

            searchField.leadingAnchor.constraint(equalTo: searchContainer.leadingAnchor),
            searchField.trailingAnchor.constraint(equalTo: searchContainer.trailingAnchor),
            searchField.topAnchor.constraint(equalTo: searchContainer.topAnchor),
            searchField.bottomAnchor.constraint(equalTo: searchContainer.bottomAnchor),

            collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            collectionView.topAnchor.constraint(equalTo: searchContainer.bottomAnchor, constant: EmojiPickerView.searchBarPadding),
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
    }

    private func makeCompositionalLayout() -> UICollectionViewCompositionalLayout {
        let layout = UICollectionViewCompositionalLayout { [weak self] _, env in
            guard let self = self else { return nil }

            let spacing = EmojiPickerView.cellSpacing
            let rowCount = self.traitCollection.verticalSizeClass == .compact
                ? 3 : 4
            let interGaps = CGFloat(rowCount - 1)
            // Cap prevents cellH from absorbing all leftover vertical space —
            // without it, reducing cellSpacing just inflates cell padding and
            // the visible gap doesn't change.
            let maxCellSize: CGFloat = 52
            let containerH = env.container.effectiveContentSize.height
            let usableH = max(80, containerH - interGaps * spacing - 2 * spacing)
            let cellH = min(floor(usableH / CGFloat(rowCount)), maxCellSize)
            let cellSide = cellH

            let itemSize = NSCollectionLayoutSize(
                widthDimension: .absolute(cellSide),
                heightDimension: .absolute(cellH)
            )
            let item = NSCollectionLayoutItem(layoutSize: itemSize)

            let groupHeight = cellH * CGFloat(rowCount) + spacing * interGaps
            let groupSize = NSCollectionLayoutSize(
                widthDimension: .absolute(cellSide),
                heightDimension: .absolute(groupHeight)
            )
            let group = NSCollectionLayoutGroup.vertical(
                layoutSize: groupSize, subitem: item, count: rowCount
            )
            group.interItemSpacing = .fixed(spacing)

            let baseTopBottom = spacing
            let usedH = groupHeight + 2 * baseTopBottom
            let leftover = max(0, containerH - usedH)
            let extraTop = floor(leftover / 2)
            let extraBottom = leftover - extraTop

            let section = NSCollectionLayoutSection(group: group)
            section.interGroupSpacing = spacing
            section.contentInsets = NSDirectionalEdgeInsets(
                top: baseTopBottom + extraTop,
                leading: spacing / 2,
                bottom: baseTopBottom + extraBottom,
                trailing: spacing / 2
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
        // Tear down existing buttons.
        for view in bottomStrip.arrangedSubviews {
            bottomStrip.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        categoryButtons.removeAll()

        // Leading: "ABC" — back to alphabetic layout.
        bottomStrip.addArrangedSubview(abcButton)

        // Middle: one button per visible category.
        for (idx, cat) in visibleCategories.enumerated() {
            let btn = StripIconButton(symbolName: cat.symbolName, theme: theme)
            btn.accessibilityLabel = cat.displayName
            btn.tag = idx
            btn.addTarget(self, action: #selector(handleCategoryTap(_:)), for: .touchUpInside)
            bottomStrip.addArrangedSubview(btn)
            categoryButtons.append(btn)
        }

        // Trailing: delete.
        bottomStrip.addArrangedSubview(deleteButton)
    }

    private func updateCategorySelection() {
        for (idx, btn) in categoryButtons.enumerated() {
            btn.setSelected(idx == currentCategoryIndex)
        }
    }

    @objc private func handleCategoryTap(_ sender: UIButton) {
        let idx = sender.tag
        guard idx < visibleCategories.count else { return }
        currentCategoryIndex = idx
        updateCategorySelection()
        guard collectionView.numberOfItems(inSection: idx) > 0 else { return }
        let indexPath = IndexPath(item: 0, section: idx)
        isAnimatingProgrammaticScroll = true
        collectionView.scrollToItem(at: indexPath, at: .left, animated: true)
    }

    @objc private func handleABCTap() {
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
        HapticManager.keyTap()
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
        // unhighlights (hiding the balloon) and never commits a select.
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
        titleLabel?.font = .systemFont(ofSize: 17, weight: .regular)
        applyColors()
    }

    required init?(coder: NSCoder) { fatalError() }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyColors()
    }

    private func applyColors() {
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
        let cfg = UIImage.SymbolConfiguration(pointSize: 18, weight: .regular)
        setImage(
            UIImage(systemName: symbolName, withConfiguration: cfg),
            for: .normal
        )
        adjustsImageWhenHighlighted = false
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.isUserInteractionEnabled = false
        pill.layer.cornerRadius = 15
        pill.layer.cornerCurve = .continuous
        pill.backgroundColor = .clear
        insertSubview(pill, at: 0)
        NSLayoutConstraint.activate([
            pill.centerXAnchor.constraint(equalTo: centerXAnchor),
            pill.centerYAnchor.constraint(equalTo: centerYAnchor),
            pill.widthAnchor.constraint(equalToConstant: 30),
            pill.heightAnchor.constraint(equalToConstant: 30),
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
        tintColor = isSelectedState
            ? theme.keyText
            : theme.emojiCategoryInactiveTint
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
        let cfg = UIImage.SymbolConfiguration(pointSize: 18, weight: .regular)
        setImage(
            UIImage(systemName: "delete.left", withConfiguration: cfg),
            for: .normal
        )
        adjustsImageWhenHighlighted = false
        repeater.onCharRepeat = { [weak self] in self?.onDelete?() }
        repeater.onWordRepeat = { [weak self] in self?.onDeleteWord?() }
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
        tintColor = theme.keyText
    }

    @objc private func handleDown() {
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
        // Glyph scales with the cell. The 0.75 ratio keeps native-sized
        // ~39pt emojis in 52pt portrait cells while leaving gaps as tight
        // as the system emoji keyboard's. Only rebuild the font when the
        // cell height actually changes — layoutSubviews fires repeatedly
        // and reassigning the font re-lays out the label each time.
        guard bounds.height != lastGlyphHeight else { return }
        lastGlyphHeight = bounds.height
        label.font = .systemFont(ofSize: floor(bounds.height * 0.75))
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
