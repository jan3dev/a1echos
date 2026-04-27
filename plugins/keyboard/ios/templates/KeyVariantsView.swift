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

        // Preferred cell size matches the key. Shrink horizontally if the
        // total width would overflow the container.
        var cellW = keyFrame.width
        let maxAvailableW =
            containerWidth - 2 * Self.outerPadding - CGFloat(max(count - 1, 0)) * Self.cellSpacing
        if CGFloat(count) * cellW > maxAvailableW {
            cellW = floor(maxAvailableW / CGFloat(count))
        }
        let cellH = keyFrame.height

        let totalCellsW = CGFloat(count) * cellW + CGFloat(max(count - 1, 0)) * Self.cellSpacing
        let popoverWidth = totalCellsW + 2 * Self.outerPadding
        let popoverHeight = cellH + 2 * Self.outerPadding

        var popoverX = keyFrame.midX - popoverWidth / 2
        popoverX = max(0, min(containerWidth - popoverWidth, popoverX))
        let popoverY = max(0, keyFrame.minY - popoverHeight - Self.gapAboveKey)

        frame = CGRect(x: popoverX, y: popoverY, width: popoverWidth, height: popoverHeight)

        rebuildLabels(cellWidth: cellW, cellHeight: cellH)

        // Default highlight: cell whose midX is nearest to the original key.
        let keyMidInPopover = keyFrame.midX - popoverX
        var bestIndex = 0
        var bestDist = CGFloat.greatestFiniteMagnitude
        for (i, cellFrame) in variantFrames.enumerated() {
            let dist = abs(cellFrame.midX - keyMidInPopover)
            if dist < bestDist {
                bestDist = dist
                bestIndex = i
            }
        }
        highlightedIndex = bestIndex
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
    /// coordinate space. Touches off either side snap to the outer cell.
    func updateHighlight(at locationInContainer: CGPoint) {
        let xInPopover = locationInContainer.x - frame.minX
        var newIndex = highlightedIndex

        if let first = variantFrames.first, xInPopover < first.minX {
            newIndex = 0
        } else if let last = variantFrames.last, xInPopover >= last.maxX {
            newIndex = variantFrames.count - 1
        } else {
            for (i, cellFrame) in variantFrames.enumerated()
            where xInPopover >= cellFrame.minX && xInPopover < cellFrame.maxX {
                newIndex = i
                break
            }
        }

        if newIndex != highlightedIndex {
            highlightedIndex = newIndex
            applyHighlightStyles()
        }
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

    private func rebuildLabels(cellWidth: CGFloat, cellHeight: CGFloat) {
        for label in variantLabels {
            label.removeFromSuperview()
        }
        variantLabels.removeAll()
        variantFrames.removeAll()

        var x: CGFloat = Self.outerPadding
        for variant in variants {
            let label = UILabel()
            label.text = variant
            label.textAlignment = .center
            label.font = UIFont.systemFont(ofSize: 22, weight: .regular)
            let cellFrame = CGRect(x: x, y: Self.outerPadding,
                                   width: cellWidth, height: cellHeight)
            label.frame = cellFrame
            addSubview(label)
            variantLabels.append(label)
            variantFrames.append(cellFrame)
            x += cellWidth + Self.cellSpacing
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
