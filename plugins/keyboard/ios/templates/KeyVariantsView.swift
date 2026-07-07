import UIKit

/// Horizontal popover shown above a long-pressed letter key, displaying the
/// available accent variants. The active variant is highlighted in brand
/// blue; the consumer drives selection via `updateHighlight(at:)` while
/// tracking the press, then reads `selectedVariant()` on release.
final class KeyVariantsView: UIView {

    private let theme = KeyboardTheme()
    private let backgroundLayer = CAShapeLayer()
    private let highlightLayer = CAShapeLayer()
    private var variantLabels: [UILabel] = []
    private var variantFrames: [CGRect] = []
    private(set) var variants: [String] = []
    private(set) var highlightedIndex: Int = 0

    private static let cellSpacing: CGFloat = 4
    private static let outerPadding: CGFloat = 6
    private static let cornerRadius: CGFloat = 12
    private static let highlightCornerRadius: CGFloat = 8
    private static let gapAboveKey: CGFloat = 6
    /// Max cells per row before the popup wraps to a new row. Matches
    /// LatinIME's default more-keys column cap (it uses 5; we allow 6 to
    /// keep common accent sets on a single row).
    private static let maxColumns: Int = 6

    init() {
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        isHidden = true
        alpha = 0
        backgroundColor = .clear

        layer.addSublayer(backgroundLayer)
        layer.addSublayer(highlightLayer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        backgroundLayer.fillColor = theme.keyPopupBackground.cgColor
        let path = UIBezierPath(roundedRect: bounds, cornerRadius: Self.cornerRadius)
        backgroundLayer.path = path.cgPath
        backgroundLayer.frame = bounds
        highlightLayer.frame = bounds
    }

    /// Lays out the variant cells, positions the popover above `keyFrame`,
    /// and selects the cell whose center is closest to the key (the
    /// natural "default" the user releases onto without dragging).
    func show(variants: [String], keyFrame: CGRect, in container: UIView) {
        self.variants = variants

        let count = variants.count
        let containerWidth = container.bounds.width

        // Wrap into a grid when there are more variants than fit in one row
        // (e.g. "o" has 8 accents) so the popup never runs off-screen. With
        // count <= maxColumns this is a single row and the geometry matches
        // the previous single-row layout exactly.
        let columns = max(min(count, Self.maxColumns), 1)
        let rows = Int(ceil(Double(count) / Double(columns)))

        // Preferred cell size matches the key. Shrink horizontally if the
        // widest row would overflow the container.
        var cellW = keyFrame.width
        let maxAvailableW =
            containerWidth - 2 * Self.outerPadding - CGFloat(columns - 1) * Self.cellSpacing
        if CGFloat(columns) * cellW > maxAvailableW {
            cellW = floor(maxAvailableW / CGFloat(columns))
        }
        let cellH = keyFrame.height

        let gridW = CGFloat(columns) * cellW + CGFloat(columns - 1) * Self.cellSpacing
        let gridH = CGFloat(rows) * cellH + CGFloat(max(rows - 1, 0)) * Self.cellSpacing
        let popoverWidth = gridW + 2 * Self.outerPadding
        let popoverHeight = gridH + 2 * Self.outerPadding

        var popoverX = keyFrame.midX - popoverWidth / 2
        popoverX = max(0, min(containerWidth - popoverWidth, popoverX))
        let popoverY = max(0, keyFrame.minY - popoverHeight - Self.gapAboveKey)

        frame = CGRect(x: popoverX, y: popoverY, width: popoverWidth, height: popoverHeight)

        rebuildLabels(columns: columns, cellWidth: cellW, cellHeight: cellH)

        // Default highlight: cell nearest the originating key center. For a
        // single row this reduces to the horizontally-nearest cell (the
        // previous behavior); for a grid it picks the closest bottom-row cell.
        let keyCenterInPopover = CGPoint(
            x: keyFrame.midX - popoverX, y: keyFrame.midY - popoverY
        )
        highlightedIndex = nearestCellIndex(to: keyCenterInPopover) ?? 0
        applyHighlightStyles()

        if superview !== container {
            removeFromSuperview()
            container.addSubview(self)
        } else {
            container.bringSubviewToFront(self)
        }

        isHidden = false
        UIView.animate(withDuration: 0.05) { self.alpha = 1 }
    }

    /// Updates the highlighted variant from a touch in the container's
    /// coordinate space. Picks the nearest cell, so a finger resting below
    /// the popup (still on the key) tracks horizontally, and in a multi-row
    /// popup it can travel up through rows. A single-row popup ignores Y
    /// (all cells share one row) and clamps off-edge drags to the end cell.
    func updateHighlight(at locationInContainer: CGPoint) {
        let pointInPopover = CGPoint(
            x: locationInContainer.x - frame.minX,
            y: locationInContainer.y - frame.minY
        )
        guard let newIndex = nearestCellIndex(to: pointInPopover) else { return }
        if newIndex != highlightedIndex {
            highlightedIndex = newIndex
            applyHighlightStyles()
        }
    }

    /// Index of the cell nearest `point` (popover coords) by squared
    /// distance to the cell rect (0 when inside).
    private func nearestCellIndex(to point: CGPoint) -> Int? {
        var bestIndex: Int? = nil
        var bestDistSq = CGFloat.infinity
        for (i, f) in variantFrames.enumerated() {
            let dx = max(f.minX - point.x, max(0, point.x - f.maxX))
            let dy = max(f.minY - point.y, max(0, point.y - f.maxY))
            let d = dx * dx + dy * dy
            if d < bestDistSq {
                bestDistSq = d
                bestIndex = i
            }
        }
        return bestIndex
    }

    func selectedVariant() -> String? {
        guard variantLabels.indices.contains(highlightedIndex) else { return nil }
        return variants[highlightedIndex]
    }

    func hide() {
        UIView.animate(
            withDuration: 0.12,
            animations: { self.alpha = 0 },
            completion: { [weak self] _ in
                if self?.alpha == 0 { self?.isHidden = true }
            }
        )
    }

    // MARK: - Private

    private func rebuildLabels(columns: Int, cellWidth: CGFloat, cellHeight: CGFloat) {
        for label in variantLabels {
            label.removeFromSuperview()
        }
        variantLabels.removeAll()
        variantFrames.removeAll()

        for (i, variant) in variants.enumerated() {
            let row = i / columns
            let col = i % columns
            let x = Self.outerPadding + CGFloat(col) * (cellWidth + Self.cellSpacing)
            let y = Self.outerPadding + CGFloat(row) * (cellHeight + Self.cellSpacing)
            let cellFrame = CGRect(x: x, y: y, width: cellWidth, height: cellHeight)
            let label = UILabel()
            label.text = variant
            label.textAlignment = .center
            label.font = UIFont.systemFont(ofSize: 22, weight: .regular)
            label.frame = cellFrame
            addSubview(label)
            variantLabels.append(label)
            variantFrames.append(cellFrame)
        }
    }

    private func applyHighlightStyles() {
        for (i, label) in variantLabels.enumerated() {
            label.textColor = i == highlightedIndex
                ? theme.micButtonIcon
                : theme.keyText
        }
        guard variantFrames.indices.contains(highlightedIndex) else {
            highlightLayer.path = nil
            return
        }
        let cell = variantFrames[highlightedIndex].insetBy(dx: -2, dy: -2)
        highlightLayer.path = UIBezierPath(
            roundedRect: cell,
            cornerRadius: Self.highlightCornerRadius
        ).cgPath
        highlightLayer.fillColor = theme.micButtonBackground.cgColor
    }
}

// MARK: - Skin tone popover

/// Sticky skin-tone popover for the hand/finger emojis. Unlike
/// `KeyVariantsView` (track-while-pressed, owner-driven), this covers the
/// whole keyboard and swallows every touch until the user taps one of the
/// variants — golden default first, then a divider, then the five
/// Fitzpatrick tones light → dark.
final class SkinToneVariantsView: UIView {

    /// Fired with the chosen Fitzpatrick modifier (nil = golden default).
    var onSelect: ((String?) -> Void)?
    /// Fired when the user dismisses without picking — a release outside
    /// every cell. Must not write a preference or insert a glyph.
    var onCancel: (() -> Void)?

    private let theme = KeyboardTheme()
    private let bubble = UIView()
    private let currentPill = UIView()
    private let hoverPill = UIView()
    private var cellLabels: [UILabel] = []
    private var cellFrames: [CGRect] = []
    /// One entry per cell: nil for the golden default, else the modifier.
    private let options: [String?]
    private let base: String
    private let currentTone: String?
    private let anchor: CGRect

    private static let cellSide: CGFloat = 38
    private static let cellSpacing: CGFloat = 2
    private static let outerPadding: CGFloat = 6
    /// Horizontal breathing room on each side of the 1pt divider line.
    private static let dividerGap: CGFloat = 5
    private static let cornerRadius: CGFloat = 12
    private static let gapAboveAnchor: CGFloat = 6
    /// Grid glyphs render at ~39pt; the popover's are slightly smaller.
    private static let glyphPointSize: CGFloat = 30

    /// `anchor` is the long-pressed emoji's frame in the presenting
    /// container's coordinate space.
    init(base: String, currentTone: String?, anchor: CGRect) {
        self.base = base
        self.currentTone = currentTone
        self.anchor = anchor
        self.options = [nil] + EmojiSkinTones.tones
        super.init(frame: .zero)
        backgroundColor = .clear
        buildBubble()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    func present(in container: UIView) {
        frame = container.bounds
        autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.addSubview(self)

        var x = anchor.midX - bubble.bounds.width / 2
        x = max(4, min(container.bounds.width - bubble.bounds.width - 4, x))
        // Prefer floating above the anchor; when there isn't room (top-row
        // grid emojis, the search-result strip near the top), drop below it
        // rather than clamping on top of the emoji the user long-pressed.
        let above = anchor.minY - bubble.bounds.height - Self.gapAboveAnchor
        let y = above >= 2 ? above : anchor.maxY + Self.gapAboveAnchor
        bubble.frame.origin = CGPoint(x: x, y: y)

        alpha = 0
        UIView.animate(withDuration: 0.08) { self.alpha = 1 }
    }

    // MARK: - Touches

    // The view is sticky by construction: any touch that doesn't end on a
    // variant cell is simply consumed, so the keyboard beneath stays inert
    // until a tone is picked.

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        updateHover(touches)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        updateHover(touches)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        hoverPill.isHidden = true
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        hoverPill.isHidden = true
        guard let touch = touches.first,
              let index = cellIndex(at: touch.location(in: bubble)) else {
            // Released outside every cell → dismiss with no insertion or
            // preference write (matches native tap-outside-to-cancel).
            onCancel?()
            return
        }
        onSelect?(options[index])
    }

    private func updateHover(_ touches: Set<UITouch>) {
        guard let touch = touches.first,
              let index = cellIndex(at: touch.location(in: bubble)) else {
            hoverPill.isHidden = true
            return
        }
        hoverPill.frame = cellFrames[index].insetBy(dx: -1, dy: -1)
        hoverPill.isHidden = false
    }

    private func cellIndex(at pointInBubble: CGPoint) -> Int? {
        // Vertical forgiveness for near-misses on the compact cells.
        // Horizontal is capped at half the inter-cell gap so adjacent hit
        // rects can't overlap — an overlap would bias seam taps to the
        // leftmost (lighter) tone via `firstIndex`.
        cellFrames.firstIndex {
            $0.insetBy(dx: -Self.cellSpacing / 2, dy: -6).contains(pointInBubble)
        }
    }

    // MARK: - Layout

    private func buildBubble() {
        let side = Self.cellSide
        let dividerBand = 2 * Self.dividerGap + 1
        let width = 2 * Self.outerPadding
            + CGFloat(options.count) * side
            + CGFloat(options.count - 2) * Self.cellSpacing
            + dividerBand
        let height = side + 2 * Self.outerPadding

        bubble.bounds = CGRect(x: 0, y: 0, width: width, height: height)
        bubble.backgroundColor = theme.keyPopupBackground
        bubble.layer.cornerRadius = Self.cornerRadius
        bubble.layer.cornerCurve = .continuous
        bubble.layer.shadowColor = UIColor.black.cgColor
        bubble.layer.shadowOpacity = 0.25
        bubble.layer.shadowRadius = 10
        bubble.layer.shadowOffset = CGSize(width: 0, height: 4)
        bubble.layer.shadowPath = UIBezierPath(
            roundedRect: bubble.bounds, cornerRadius: Self.cornerRadius
        ).cgPath
        addSubview(bubble)

        // Selection pill sits under the remembered variant so the user can
        // see (and re-tap) the current choice.
        currentPill.backgroundColor = theme.emojiCategorySelectedFill
        currentPill.layer.cornerRadius = 8
        currentPill.layer.cornerCurve = .continuous
        currentPill.isHidden = true
        bubble.addSubview(currentPill)

        hoverPill.backgroundColor = theme.emojiCellPressedFill
        hoverPill.layer.cornerRadius = 8
        hoverPill.layer.cornerCurve = .continuous
        hoverPill.isHidden = true
        bubble.addSubview(hoverPill)

        var x = Self.outerPadding
        for (i, option) in options.enumerated() {
            let cellFrame = CGRect(
                x: x, y: Self.outerPadding, width: side, height: side
            )
            let label = UILabel(frame: cellFrame)
            label.text = EmojiSkinTones.applying(option, to: base)
            label.textAlignment = .center
            label.font = .systemFont(ofSize: Self.glyphPointSize)
            bubble.addSubview(label)
            cellLabels.append(label)
            cellFrames.append(cellFrame)

            if option == currentTone {
                currentPill.frame = cellFrame.insetBy(dx: -1, dy: -1)
                currentPill.isHidden = false
            }

            if i == 0 {
                // Grey divider separating the golden default from the tones.
                let line = UIView(frame: CGRect(
                    x: x + side + Self.dividerGap,
                    y: Self.outerPadding + side * 0.2,
                    width: 1,
                    height: side * 0.6
                ))
                line.backgroundColor = theme.emojiCategoryInactiveTint
                bubble.addSubview(line)
                x += side + dividerBand
            } else {
                x += side + Self.cellSpacing
            }
        }
    }
}
