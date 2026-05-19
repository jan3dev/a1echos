import UIKit

protocol EmojiSearchOverlayViewDelegate: AnyObject {
    func emojiSearchOverlayDidClearQuery(_ view: EmojiSearchOverlayView)
    func emojiSearchOverlay(
        _ view: EmojiSearchOverlayView, didSelect emoji: String
    )
}

final class EmojiSearchOverlayView: UIView {

    // 60 portrait / 36 landscape so the overlay fits the shorter landscape keyboard.
    private var resultsStripHeight: CGFloat {
        traitCollection.verticalSizeClass == .compact ? 36 : 60
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
        rebuildResults(results, hasQuery: !query.isEmpty)
    }

    private func setupView() {
        backgroundColor = .clear

        searchBackground.translatesAutoresizingMaskIntoConstraints = false
        searchBackground.backgroundColor = theme.emojiSearchBarFill
        searchBackground.layer.cornerRadius = 10
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
        clearButton.tintColor = theme.emojiCategoryInactiveTint
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

        NSLayoutConstraint.activate([
            searchBackground.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            searchBackground.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            searchBackground.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            searchBackground.heightAnchor.constraint(equalToConstant: 32),

            glass.leadingAnchor.constraint(equalTo: searchBackground.leadingAnchor, constant: 10),
            glass.centerYAnchor.constraint(equalTo: searchBackground.centerYAnchor),
            glass.widthAnchor.constraint(equalToConstant: 20),
            glass.heightAnchor.constraint(equalToConstant: 20),

            pillInternals.leadingAnchor.constraint(equalTo: glass.trailingAnchor, constant: 6),
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
        resultsStack.spacing = 4
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
            empty.text = hasQuery ? "No emojis found" : ""
            empty.font = .systemFont(ofSize: 13)
            empty.textColor = theme.emojiCategoryInactiveTint
            resultsStack.addArrangedSubview(empty)
            return
        }
        let capped = emojis.prefix(60)
        for emoji in capped {
            let btn = SearchResultButton(emoji: emoji)
            btn.addTarget(self, action: #selector(handleResultTap(_:)), for: .touchUpInside)
            resultsStack.addArrangedSubview(btn)
            btn.widthAnchor.constraint(equalToConstant: 52).isActive = true
        }
    }

    @objc private func handleClearTap() {
        delegate?.emojiSearchOverlayDidClearQuery(self)
    }

    @objc private func handleResultTap(_ sender: SearchResultButton) {
        guard let emoji = sender.emoji else { return }
        delegate?.emojiSearchOverlay(self, didSelect: emoji)
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
    let emoji: String?

    init(emoji: String) {
        self.emoji = emoji
        super.init(frame: .zero)
        setTitle(emoji, for: .normal)
        titleLabel?.font = .systemFont(ofSize: 36)
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
