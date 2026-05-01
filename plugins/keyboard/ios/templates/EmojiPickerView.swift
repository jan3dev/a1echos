import UIKit

protocol EmojiPickerViewDelegate: AnyObject {
    func emojiPicker(_ view: EmojiPickerView, didSelect emoji: String)
    /// Bottom-bar keys (ABC / space / delete) need the parent's standard touch
    /// pipeline so hold-to-repeat (delete) and the unified press feedback keep
    /// working inside the picker. The parent attaches its own touch targets
    /// when this fires.
    func emojiPicker(_ view: EmojiPickerView, registerBottomBarKey button: KeyButton)
}

/// In-keyboard emoji picker: category strip on top, scrollable grid in the
/// middle, and an ABC / space / delete bottom bar that mirrors the rest of
/// the keyboard's row metrics. Used in `LayoutMode.emoji` since iOS doesn't
/// let third-party keyboards jump to the system Emoji keyboard directly.
final class EmojiPickerView: UIView, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {

    weak var delegate: EmojiPickerViewDelegate?

    private let theme: KeyboardTheme
    private let categoryStripScroll = UIScrollView()
    private let categoryStripStack = UIStackView()
    private var categoryButtons: [UIButton] = []

    private let collectionView: UICollectionView

    private let bottomBar = UIStackView()
    private let abcButton: KeyButton
    private let spaceButton: KeyButton
    private let deleteButton: KeyButton

    /// Categories that have at least one emoji to display. `recents` is
    /// hidden when empty so first-time users don't see a blank tab.
    private var visibleCategories: [EmojiCategory] = []
    /// Snapshot of the emojis displayed per section. Reading from the live
    /// `EmojiData.emojis(for:)` between taps would race with `RecentEmojis`
    /// reordering and let the user insert a different emoji than the one
    /// they tapped. Refreshed each time the picker is rebuilt.
    private var sectionData: [[String]] = []
    private var currentCategoryIndex: Int = 0
    private var didRegisterBottomBar = false

    init(theme: KeyboardTheme) {
        self.theme = theme

        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumInteritemSpacing = 2
        layout.minimumLineSpacing = 2
        layout.sectionInset = UIEdgeInsets(top: 2, left: 6, bottom: 4, right: 6)
        self.collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)

        self.abcButton = KeyButton(
            keyDefinition: KeyboardLayout.KeyDefinition(
                label: "ABC",
                type: .modeSwitch,
                widthWeight: 1.5,
                accessibilityLabel: "Letters"
            ),
            theme: theme
        )
        self.spaceButton = KeyButton(
            keyDefinition: KeyboardLayout.KeyDefinition(
                label: "space",
                type: .space,
                widthWeight: 5.0,
                accessibilityLabel: "Space"
            ),
            theme: theme
        )
        self.deleteButton = KeyButton(
            keyDefinition: KeyboardLayout.KeyDefinition(
                label: "",
                type: .delete,
                widthWeight: 1.5,
                accessibilityLabel: "Delete",
                symbolName: "delete.left"
            ),
            theme: theme
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

        categoryStripScroll.translatesAutoresizingMaskIntoConstraints = false
        categoryStripScroll.showsHorizontalScrollIndicator = false
        categoryStripScroll.showsVerticalScrollIndicator = false
        addSubview(categoryStripScroll)

        categoryStripStack.axis = .horizontal
        categoryStripStack.spacing = 0
        categoryStripStack.alignment = .fill
        categoryStripStack.distribution = .fillEqually
        categoryStripStack.translatesAutoresizingMaskIntoConstraints = false
        categoryStripScroll.addSubview(categoryStripStack)

        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.backgroundColor = .clear
        collectionView.register(EmojiCell.self, forCellWithReuseIdentifier: EmojiCell.reuseId)
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.alwaysBounceVertical = true
        addSubview(collectionView)

        bottomBar.axis = .horizontal
        bottomBar.spacing = 6
        bottomBar.alignment = .fill
        bottomBar.distribution = .fill
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        bottomBar.addArrangedSubview(abcButton)
        bottomBar.addArrangedSubview(spaceButton)
        bottomBar.addArrangedSubview(deleteButton)
        addSubview(bottomBar)

        // Width ratios mirror the regular keyboard's bottom row (ABC : space :
        // delete = 1.5 : 5 : 1.5) so the spacebar fills the gap and the
        // ABC/delete keys end up the same width. Without these the spacebar
        // collapses to the intrinsic width of its "space" label and renders
        // behind the delete pill.
        abcButton.widthAnchor.constraint(equalTo: deleteButton.widthAnchor).isActive = true
        spaceButton.widthAnchor.constraint(
            equalTo: abcButton.widthAnchor,
            multiplier: 5.0 / 1.5
        ).isActive = true

        NSLayoutConstraint.activate([
            categoryStripScroll.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            categoryStripScroll.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            categoryStripScroll.topAnchor.constraint(equalTo: topAnchor),
            categoryStripScroll.heightAnchor.constraint(equalToConstant: 30),

            categoryStripStack.leadingAnchor.constraint(equalTo: categoryStripScroll.contentLayoutGuide.leadingAnchor),
            categoryStripStack.trailingAnchor.constraint(equalTo: categoryStripScroll.contentLayoutGuide.trailingAnchor),
            categoryStripStack.topAnchor.constraint(equalTo: categoryStripScroll.contentLayoutGuide.topAnchor),
            categoryStripStack.bottomAnchor.constraint(equalTo: categoryStripScroll.contentLayoutGuide.bottomAnchor),
            categoryStripStack.heightAnchor.constraint(equalTo: categoryStripScroll.frameLayoutGuide.heightAnchor),
            categoryStripStack.widthAnchor.constraint(greaterThanOrEqualTo: categoryStripScroll.frameLayoutGuide.widthAnchor),

            collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            collectionView.topAnchor.constraint(equalTo: categoryStripScroll.bottomAnchor, constant: 2),
            collectionView.bottomAnchor.constraint(equalTo: bottomBar.topAnchor, constant: -4),

            bottomBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            bottomBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            bottomBar.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2),
            bottomBar.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        // Defer registration until the view is in a window so the parent
        // KeyboardView is guaranteed to be wired up.
        guard window != nil, !didRegisterBottomBar else { return }
        didRegisterBottomBar = true
        delegate?.emojiPicker(self, registerBottomBarKey: abcButton)
        delegate?.emojiPicker(self, registerBottomBarKey: spaceButton)
        delegate?.emojiPicker(self, registerBottomBarKey: deleteButton)
    }

    // MARK: - Public

    /// Refreshes the recents tab. Called when the picker is shown so newly
    /// recorded emojis appear without a layout rebuild.
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
        rebuildCategoryButtons()
        collectionView.reloadData()
        currentCategoryIndex = 0
        updateCategorySelection()
    }

    private func rebuildCategoryButtons() {
        for view in categoryStripStack.arrangedSubviews {
            categoryStripStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        categoryButtons.removeAll()
        for (idx, cat) in visibleCategories.enumerated() {
            let btn = UIButton(type: .system)
            btn.setImage(UIImage(systemName: cat.symbolName), for: .normal)
            btn.tintColor = theme.keyText
            btn.accessibilityLabel = cat.displayName
            btn.tag = idx
            btn.addTarget(self, action: #selector(handleCategoryTap(_:)), for: .touchUpInside)
            btn.widthAnchor.constraint(greaterThanOrEqualToConstant: 36).isActive = true
            categoryStripStack.addArrangedSubview(btn)
            categoryButtons.append(btn)
        }
    }

    private func updateCategorySelection() {
        for (idx, btn) in categoryButtons.enumerated() {
            btn.alpha = idx == currentCategoryIndex ? 1.0 : 0.5
        }
    }

    @objc private func handleCategoryTap(_ sender: UIButton) {
        let idx = sender.tag
        guard idx < visibleCategories.count else { return }
        currentCategoryIndex = idx
        updateCategorySelection()
        guard collectionView.numberOfItems(inSection: idx) > 0 else { return }
        let indexPath = IndexPath(item: 0, section: idx)
        collectionView.scrollToItem(at: indexPath, at: .top, animated: true)
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
        cell.configure(with: sectionData[indexPath.section][indexPath.item])
        return cell
    }

    // MARK: - UICollectionViewDelegate

    func collectionView(
        _ collectionView: UICollectionView,
        layout: UICollectionViewLayout,
        sizeForItemAt indexPath: IndexPath
    ) -> CGSize {
        // 9 emojis per row keeps cells small enough that ~3 rows of grid
        // are visible above the bottom bar even on shorter devices.
        let totalWidth = collectionView.bounds.width - 12 // section insets
        let perRow: CGFloat = 9
        let spacing: CGFloat = 2 * (perRow - 1)
        let side = max(20, floor((totalWidth - spacing) / perRow))
        return CGSize(width: side, height: side)
    }

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
        guard scrollView === collectionView else { return }
        let visibleSections = collectionView.indexPathsForVisibleItems.map(\.section)
        guard let topSection = visibleSections.min() else { return }
        if topSection != currentCategoryIndex {
            currentCategoryIndex = topSection
            updateCategorySelection()
        }
    }
}

// MARK: - Cell

private final class EmojiCell: UICollectionViewCell {
    static let reuseId = "EmojiCell"

    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        label.translatesAutoresizingMaskIntoConstraints = false
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 30)
        contentView.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    func configure(with emoji: String) {
        label.text = emoji
    }

    override var isHighlighted: Bool {
        didSet {
            UIView.animate(withDuration: isHighlighted ? 0.05 : 0.12) {
                self.contentView.transform = self.isHighlighted
                    ? CGAffineTransform(scaleX: 1.25, y: 1.25)
                    : .identity
            }
        }
    }
}
