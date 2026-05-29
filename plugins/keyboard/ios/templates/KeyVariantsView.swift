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

        backgroundLayer.shadowColor = theme.keyShadow.cgColor
        backgroundLayer.shadowOpacity = 1.0
        backgroundLayer.shadowOffset = CGSize(width: 0, height: 1)
        backgroundLayer.shadowRadius = 3
        layer.addSublayer(backgroundLayer)
        layer.addSublayer(highlightLayer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        backgroundLayer.fillColor = theme.keyBackground.cgColor
        let path = UIBezierPath(roundedRect: bounds, cornerRadius: Self.cornerRadius)
        backgroundLayer.path = path.cgPath
        backgroundLayer.shadowPath = path.cgPath
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
