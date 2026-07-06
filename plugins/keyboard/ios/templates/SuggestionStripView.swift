import UIKit

/// One strip slot. Mirrors the native iOS QuickType layout: while a
/// correction is pending the left slot shows the typed word in quotes
/// (tap = keep it and learn it), the emphasized center slot shows the
/// correction that autocorrect will apply, and the right slot a runner-up.
struct SuggestionSlot {
    /// The raw text tapping this slot commits (never quoted).
    let text: String
    /// True for the quoted "keep what I typed" slot.
    let isVerbatim: Bool
    /// Semibold — marks the word autocorrect is about to apply.
    let isEmphasized: Bool

    static func candidate(_ text: String) -> SuggestionSlot {
        SuggestionSlot(text: text, isVerbatim: false, isEmphasized: false)
    }
}

protocol SuggestionStripViewDelegate: AnyObject {
    func suggestionStrip(_ strip: SuggestionStripView, didSelect slot: SuggestionSlot)
}

/// Up-to-3 tappable word candidates shown in place of the top bar's
/// logo/record chrome while the user composes a word (§5.5). Tapping a
/// candidate asks the delegate to replace the in-progress word (or keep it,
/// for the verbatim slot). The strip is hidden whenever there are no
/// candidates or the bar is busy recording.
final class SuggestionStripView: UIView {

    weak var delegate: SuggestionStripViewDelegate?

    private let stack = UIStackView()
    private var candidateButtons: [UIButton] = []
    private var slots: [SuggestionSlot] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        // .fill (not .fillEqually): the hairline dividers are arranged
        // alongside the buttons, so equal widths are enforced explicitly on
        // the buttons in `setSlots` and the 1pt dividers stay thin.
        stack.axis = .horizontal
        stack.distribution = .fill
        stack.alignment = .fill
        stack.spacing = 0
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
        ])
    }

    /// Replaces the strip's contents. At most 3 buttons, so a full teardown +
    /// rebuild is cheaper than diffing. The caller hides the strip for an
    /// empty list — this only populates it.
    func setSlots(_ newSlots: [SuggestionSlot]) {
        for view in stack.arrangedSubviews {
            stack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        candidateButtons.removeAll()
        slots = Array(newSlots.prefix(3))

        for (idx, slot) in slots.enumerated() {
            if idx > 0 { stack.addArrangedSubview(makeDivider()) }
            let button = makeButton(slot: slot, index: idx)
            stack.addArrangedSubview(button)
            candidateButtons.append(button)
        }

        // Equal-width candidates: pin each to the first button's width so the
        // 1pt dividers don't skew the layout the way .fillEqually would.
        if let reference = candidateButtons.first {
            for button in candidateButtons.dropFirst() {
                button.widthAnchor.constraint(equalTo: reference.widthAnchor).isActive = true
            }
        }
    }

    private func makeButton(slot: SuggestionSlot, index: Int) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        let title = slot.isVerbatim ? "\u{201C}\(slot.text)\u{201D}" : slot.text
        button.setTitle(title, for: .normal)
        button.setTitleColor(.label, for: .normal)
        button.titleLabel?.font = .systemFont(
            ofSize: 17, weight: slot.isEmphasized ? .semibold : .regular
        )
        if slot.isEmphasized {
            // Native-style highlight on the word autocorrect is about to
            // apply.
            button.backgroundColor = UIColor.label.withAlphaComponent(0.08)
            button.layer.cornerRadius = 8
            button.layer.masksToBounds = true
        }
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.7
        button.titleLabel?.lineBreakMode = .byTruncatingTail
        button.accessibilityLabel = slot.isVerbatim
            ? "Keep \(slot.text)" : slot.text
        button.tag = index
        button.addTarget(self, action: #selector(candidateTapped(_:)), for: .touchUpInside)
        return button
    }

    private func makeDivider() -> UIView {
        let divider = UIView()
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.backgroundColor = UIColor.label.withAlphaComponent(0.15)
        divider.widthAnchor.constraint(equalToConstant: 1).isActive = true
        return divider
    }

    @objc private func candidateTapped(_ sender: UIButton) {
        guard sender.tag >= 0, sender.tag < slots.count else { return }
        HapticManager.keyTap()
        delegate?.suggestionStrip(self, didSelect: slots[sender.tag])
    }
}
