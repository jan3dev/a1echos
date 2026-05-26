import UIKit

protocol EmojiPickerViewDelegate: AnyObject {
    func emojiPicker(_ view: EmojiPickerView, didSelect emoji: String)
    func emojiPickerDidTapABC(_ view: EmojiPickerView)
    func emojiPickerDidTapDelete(_ view: EmojiPickerView)
    func emojiPickerDidHoldDeleteWord(_ view: EmojiPickerView)
    func emojiPickerDidActivateSearch(_ view: EmojiPickerView)
}

final class EmojiPickerView: UIView, UICollectionViewDataSource,
    UICollectionViewDelegate, UITextFieldDelegate {

    weak var delegate: EmojiPickerViewDelegate?

    private let theme: KeyboardTheme

    private let searchContainer = UIView()
    private let searchField = UITextField()
    private let categoryTitleLabel = UILabel()

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

    private static let searchBarHeight: CGFloat = 32
    private static let stripHeight: CGFloat = 38
    private static let categoryTitleHeight: CGFloat = 22
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
        searchField.layer.cornerRadius = 10
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

        // ---- Category title (single row, between search and grid) ----
        categoryTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        categoryTitleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        categoryTitleLabel.textColor = theme.emojiSectionHeaderText
        categoryTitleLabel.textAlignment = .left
        addSubview(categoryTitleLabel)

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

            // Category title row — flush with the grid's leading column
            // (12pt = 4pt outer padding around grid + 8pt to align with
            // the first emoji's content rect).
            categoryTitleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            categoryTitleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            categoryTitleLabel.topAnchor.constraint(equalTo: searchContainer.bottomAnchor, constant: EmojiPickerView.searchBarPadding),
            categoryTitleLabel.heightAnchor.constraint(equalToConstant: EmojiPickerView.categoryTitleHeight),

            collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            collectionView.topAnchor.constraint(equalTo: categoryTitleLabel.bottomAnchor, constant: 0),
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
                ? 3 : 5
            let interGaps = CGFloat(rowCount - 1)
            // Cap prevents cellH from absorbing all leftover vertical space —
            // without it, reducing cellSpacing just inflates cell padding and
            // the visible gap doesn't change.
            let maxCellSize: CGFloat = 44
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
        updateCategoryTitle()
    }

    private func updateCategoryTitle() {
        guard currentCategoryIndex < visibleCategories.count else {
            categoryTitleLabel.text = nil
            return
        }
        categoryTitleLabel.text =
            visibleCategories[currentCategoryIndex].stripTitle.uppercased()
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
        updateCategoryTitle()
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
            with: sectionData[indexPath.section][indexPath.item],
            theme: theme
        )
        return cell
    }

    // MARK: - UICollectionViewDelegate

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        guard indexPath.section < sectionData.count,
              indexPath.item < sectionData[indexPath.section].count else { return }
        let emoji = sectionData[indexPath.section][indexPath.item]
        RecentEmojis.shared.record(emoji)
        delegate?.emojiPicker(self, didSelect: emoji)
        HapticManager.keyTap()
        collectionView.deselectItem(at: indexPath, animated: false)
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard scrollView === collectionView, !isAnimatingProgrammaticScroll else { return }
        // Active category tracks the leftmost visible section.
        let visibleSections = collectionView.indexPathsForVisibleItems.map(\.section)
        guard let leftSection = visibleSections.min() else { return }
        if leftSection != currentCategoryIndex {
            currentCategoryIndex = leftSection
            updateCategorySelection()
            updateCategoryTitle()
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
        label.font = .systemFont(ofSize: 30)
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.6
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

// MARK: - Category title

private extension EmojiCategory {
    var stripTitle: String {
        switch self {
        case .recents: return "Frequently Used"
        case .smileys: return "Smileys & People"
        case .animals: return "Animals & Nature"
        case .food: return "Food & Drink"
        case .activity: return "Activity"
        case .travel: return "Travel & Places"
        case .objects: return "Objects"
        case .symbols: return "Symbols"
        case .flags: return "Flags"
        }
    }
}
