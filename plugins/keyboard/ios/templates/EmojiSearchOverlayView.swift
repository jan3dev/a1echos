import UIKit

protocol EmojiSearchOverlayViewDelegate: AnyObject {
    func emojiSearchOverlayDidClearQuery(_ view: EmojiSearchOverlayView)
    func emojiSearchOverlay(
        _ view: EmojiSearchOverlayView, didSelect emoji: String
    )
    /// Long-press on a skin-tone-capable result. `base` is the untinted
    /// emoji; `frame` is the result button's frame in the overlay's
    /// coordinate space.
    func emojiSearchOverlay(
        _ view: EmojiSearchOverlayView,
        didLongPressSkinTonable base: String, at frame: CGRect
    )
}

final class EmojiSearchOverlayView: UIView {

    private static let searchBarHeight: CGFloat = 40

    // Cell-sized strip so the (grid-matched) glyph isn't clipped: 56 portrait
    // (52pt cell + 4pt breathing room), 44 landscape (matches the 44pt grid
    // cell that holds the 38pt landscape glyph).
    private var resultsStripHeight: CGFloat {
        traitCollection.verticalSizeClass == .compact ? 44 : 56
    }
    // Result cells mirror the picker grid so search feels continuous:
    // 52pt cells / ~39pt glyphs portrait, 44pt / ~38pt landscape.
    private var resultCellSide: CGFloat {
        traitCollection.verticalSizeClass == .compact ? 44 : 52
    }
    // Glyph-to-cell ratio, matching the grid's `EmojiCell` so search-result
    // emojis are exactly the grid size (0.88 landscape, 0.75 portrait).
    private var resultGlyphRatio: CGFloat {
        traitCollection.verticalSizeClass == .compact ? 0.88 : 0.75
    }
    private var resultsStripHeightConstraint: NSLayoutConstraint!

    weak var delegate: EmojiSearchOverlayViewDelegate?

    private let theme: KeyboardTheme
    private let searchBackground = UIView()
    private let queryLabel = UILabel()
    private let placeholderLabel = UILabel()
    private let cursorView = UIView()
    private let clearButton = UIButton(type: .system)
    private let resultsScroll = ResultsScrollView()
    private let resultsStack = UIStackView()
    private var pillInternals = UIStackView()
    private var pillLeadingConstraint: NSLayoutConstraint!

    init(theme: KeyboardTheme) {
        self.theme = theme
        super.init(frame: .zero)
        setupView()
        startCursorBlink()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    func setQuery(_ query: String, results: [String]) {
        if query.isEmpty {
            queryLabel.isHidden = true
            queryLabel.text = nil
            placeholderLabel.isHidden = false
            clearButton.isHidden = true
        } else {
            queryLabel.text = query
            queryLabel.isHidden = false
            placeholderLabel.isHidden = true
            clearButton.isHidden = false
        }
        // With an empty query the cursor sits in front of the placeholder;
        // pull the pill left by the cursor's footprint (1.5pt + 2pt stack
        // spacing) so the placeholder stays exactly where the picker's
        // search field rendered it — no jump on focus.
        pillLeadingConstraint.constant = query.isEmpty ? 2.5 : 6
        rebuildResults(results, hasQuery: !query.isEmpty)
    }

    private func setupView() {
        backgroundColor = .clear

        searchBackground.translatesAutoresizingMaskIntoConstraints = false
        searchBackground.backgroundColor = theme.emojiSearchBarFill
        searchBackground.layer.cornerRadius = EmojiSearchOverlayView.searchBarHeight / 2
        searchBackground.layer.cornerCurve = .continuous
        addSubview(searchBackground)

        let glassConfig = UIImage.SymbolConfiguration(pointSize: 16, weight: .regular)
        let glass = UIImageView(
            image: UIImage(systemName: "magnifyingglass", withConfiguration: glassConfig)
        )
        glass.translatesAutoresizingMaskIntoConstraints = false
        glass.tintColor = theme.emojiCategoryInactiveTint
        glass.contentMode = .scaleAspectFit

        queryLabel.translatesAutoresizingMaskIntoConstraints = false
        queryLabel.font = .systemFont(ofSize: 16)
        queryLabel.textColor = theme.keyText
        queryLabel.lineBreakMode = .byTruncatingHead
        queryLabel.isHidden = true

        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.font = .systemFont(ofSize: 16)
        placeholderLabel.text = "Search Emoji"
        placeholderLabel.textColor = theme.emojiCategoryInactiveTint

        cursorView.translatesAutoresizingMaskIntoConstraints = false
        cursorView.backgroundColor = theme.micButtonBackground

        clearButton.translatesAutoresizingMaskIntoConstraints = false
        clearButton.setImage(
            UIImage(systemName: "xmark.circle.fill"), for: .normal
        )
        clearButton.tintColor = theme.emojiSearchClearFill
        clearButton.isHidden = true
        clearButton.addTarget(
            self, action: #selector(handleClearTap), for: .touchUpInside
        )

        pillInternals.translatesAutoresizingMaskIntoConstraints = false
        pillInternals.axis = .horizontal
        pillInternals.alignment = .center
        pillInternals.spacing = 2
        pillInternals.addArrangedSubview(queryLabel)
        pillInternals.addArrangedSubview(cursorView)
        pillInternals.addArrangedSubview(placeholderLabel)
        pillInternals.distribution = .fill

        searchBackground.addSubview(glass)
        searchBackground.addSubview(pillInternals)
        searchBackground.addSubview(clearButton)

        pillLeadingConstraint = pillInternals.leadingAnchor.constraint(
            equalTo: glass.trailingAnchor, constant: 2.5
        )

        NSLayoutConstraint.activate([
            searchBackground.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            searchBackground.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            searchBackground.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            searchBackground.heightAnchor.constraint(equalToConstant: EmojiSearchOverlayView.searchBarHeight),

            glass.leadingAnchor.constraint(equalTo: searchBackground.leadingAnchor, constant: 10),
            glass.centerYAnchor.constraint(equalTo: searchBackground.centerYAnchor),
            glass.widthAnchor.constraint(equalToConstant: 20),
            glass.heightAnchor.constraint(equalToConstant: 20),

            pillLeadingConstraint,
            pillInternals.trailingAnchor.constraint(lessThanOrEqualTo: clearButton.leadingAnchor, constant: -4),
            pillInternals.centerYAnchor.constraint(equalTo: searchBackground.centerYAnchor),

            cursorView.widthAnchor.constraint(equalToConstant: 1.5),
            cursorView.heightAnchor.constraint(equalToConstant: 18),

            clearButton.trailingAnchor.constraint(equalTo: searchBackground.trailingAnchor, constant: -6),
            clearButton.centerYAnchor.constraint(equalTo: searchBackground.centerYAnchor),
            clearButton.widthAnchor.constraint(equalToConstant: 20),
            clearButton.heightAnchor.constraint(equalToConstant: 20),
        ])

        resultsScroll.translatesAutoresizingMaskIntoConstraints = false
        resultsScroll.showsHorizontalScrollIndicator = false
        resultsScroll.showsVerticalScrollIndicator = false
        resultsScroll.alwaysBounceHorizontal = true
        addSubview(resultsScroll)

        resultsStack.axis = .horizontal
        resultsStack.alignment = .center
        resultsStack.spacing = 2
        resultsStack.translatesAutoresizingMaskIntoConstraints = false
        resultsScroll.addSubview(resultsStack)

        let centeringGuide = UILayoutGuide()
        addLayoutGuide(centeringGuide)

        NSLayoutConstraint.activate([
            centeringGuide.leadingAnchor.constraint(equalTo: leadingAnchor),
            centeringGuide.trailingAnchor.constraint(equalTo: trailingAnchor),
            centeringGuide.topAnchor.constraint(equalTo: searchBackground.bottomAnchor),
            centeringGuide.bottomAnchor.constraint(equalTo: bottomAnchor),

            resultsScroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            resultsScroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            resultsScroll.centerYAnchor.constraint(equalTo: centeringGuide.centerYAnchor),

            resultsStack.leadingAnchor.constraint(equalTo: resultsScroll.contentLayoutGuide.leadingAnchor, constant: 8),
            resultsStack.trailingAnchor.constraint(equalTo: resultsScroll.contentLayoutGuide.trailingAnchor, constant: -8),
            resultsStack.topAnchor.constraint(equalTo: resultsScroll.contentLayoutGuide.topAnchor),
            resultsStack.bottomAnchor.constraint(equalTo: resultsScroll.contentLayoutGuide.bottomAnchor),
            resultsStack.heightAnchor.constraint(equalTo: resultsScroll.frameLayoutGuide.heightAnchor),
        ])

        resultsStripHeightConstraint = resultsScroll.heightAnchor.constraint(
            equalToConstant: resultsStripHeight
        )
        resultsStripHeightConstraint.isActive = true
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if traitCollection.verticalSizeClass
            != previousTraitCollection?.verticalSizeClass {
            resultsStripHeightConstraint.constant = resultsStripHeight
        }
    }

    private func startCursorBlink() {
        let blink = CABasicAnimation(keyPath: "opacity")
        blink.fromValue = 1.0
        blink.toValue = 0.0
        blink.duration = 0.53
        blink.autoreverses = true
        blink.repeatCount = .infinity
        blink.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        cursorView.layer.add(blink, forKey: "cursor-blink")
    }

    private func rebuildResults(_ emojis: [String], hasQuery: Bool) {
        for view in resultsStack.arrangedSubviews {
            resultsStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        if emojis.isEmpty {
            let empty = UILabel()
            empty.text = hasQuery ? "No Results" : ""
            empty.font = .systemFont(ofSize: 15)
            empty.textAlignment = .center
            empty.textColor = theme.emojiCategoryInactiveTint
            resultsStack.addArrangedSubview(empty)
            // Span the visible strip (minus the stack's 8pt side insets)
            // so the text centers in the row instead of hugging leading.
            empty.widthAnchor.constraint(
                equalTo: resultsScroll.frameLayoutGuide.widthAnchor,
                constant: -16
            ).isActive = true
            return
        }
        let side = resultCellSide
        let glyphSize = floor(side * resultGlyphRatio)
        let capped = emojis.prefix(60)
        for emoji in capped {
            let btn = SearchResultButton(emoji: emoji, fontSize: glyphSize)
            btn.addTarget(self, action: #selector(handleResultTap(_:)), for: .touchUpInside)
            if EmojiSkinTones.supports(emoji) {
                let lp = UILongPressGestureRecognizer(
                    target: self, action: #selector(handleResultLongPress(_:))
                )
                lp.minimumPressDuration = 0.4
                btn.addGestureRecognizer(lp)
            }
            resultsStack.addArrangedSubview(btn)
            btn.widthAnchor.constraint(equalToConstant: side).isActive = true
        }
    }

    @objc private func handleClearTap() {
        delegate?.emojiSearchOverlayDidClearQuery(self)
    }

    @objc private func handleResultTap(_ sender: SearchResultButton) {
        guard let emoji = sender.emoji else { return }
        delegate?.emojiSearchOverlay(self, didSelect: emoji)
    }

    @objc private func handleResultLongPress(_ gr: UILongPressGestureRecognizer) {
        // Recognition cancels the button's touch, so no tap-select fires.
        guard gr.state == .began,
              let btn = gr.view as? SearchResultButton,
              let base = btn.emoji else { return }
        delegate?.emojiSearchOverlay(
            self, didLongPressSkinTonable: base,
            at: btn.convert(btn.bounds, to: self)
        )
    }
}

// UIScrollView.touchesShouldCancel(in:) defaults to false for UIControls,
// which would freeze the strip once a finger lands on a result emoji.
private final class ResultsScrollView: UIScrollView {
    override func touchesShouldCancel(in view: UIView) -> Bool {
        true
    }
}

private final class SearchResultButton: UIButton {
    /// The untinted base emoji — selection and skin-tone preferences stay
    /// keyed by this; only the title shows the remembered tone.
    let emoji: String?

    init(emoji: String, fontSize: CGFloat) {
        self.emoji = emoji
        super.init(frame: .zero)
        setTitle(SkinTonePreferences.shared.display(emoji), for: .normal)
        titleLabel?.font = .systemFont(ofSize: fontSize)
        adjustsImageWhenHighlighted = false
    }

    required init?(coder: NSCoder) { fatalError() }

    override var isHighlighted: Bool {
        didSet {
            UIView.animate(
                withDuration: isHighlighted ? 0.05 : 0.15,
                delay: 0,
                options: [.beginFromCurrentState, .curveEaseOut],
                animations: {
                    self.transform = self.isHighlighted
                        ? CGAffineTransform(scaleX: 1.15, y: 1.15)
                        : .identity
                }
            )
        }
    }
}
