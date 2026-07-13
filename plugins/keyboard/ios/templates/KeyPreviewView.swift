import UIKit

/// Floating "typewriter" preview shown above a pressed character key. The
/// shape is one continuous path: a rounded head at the top, a smooth
/// concave transition (no discrete head-bottom corner), and a straight
/// shaft that ends in the key footprint at the bottom — matching the
/// native iOS 26 keyboard balloon. For keys at the keyboard's edge, the
/// outer side stays as a straight vertical line aligned with the key's
/// outer edge so the balloon never tries to escape past the keyboard.
final class KeyPreviewView: UIView {

    private let label = UILabel()
    private let theme = KeyboardTheme()
    private let shapeLayer = CAShapeLayer()

    /// Geometry of the pressed key in the preview view's own coordinate
    /// space. `layoutSubviews` rebuilds the path from these.
    private var keyWidth: CGFloat = 0
    private var keyHeight: CGFloat = 0
    private var keyOriginX: CGFloat = 0
    private var headHeight: CGFloat = 0

    /// True when the balloon's outer side aligns with the key's outer edge.
    private var leftEdgeStraight: Bool = false
    private var rightEdgeStraight: Bool = false

    private static let widthRatio: CGFloat = 1.5
    private static let keyCornerRadius: CGFloat = 8
    private static let headCornerRadius: CGFloat = 14
    private static let minLabelFontSize: CGFloat = 20

    private let showsShadow: Bool
    private let maxLabelFontSize: CGFloat
    private let glyphHeightRatio: CGFloat
    /// Caps the rounded head's height. The letter keyboard uses a small cap
    /// so the head + neck fit above the top row without being clipped (and so
    /// every row gets the same compact balloon); the emoji grid, which has
    /// ample room above the cells, passes `nil` to leave the head uncapped.
    private let maxHeadHeight: CGFloat?
    /// Vertical extent of the smooth curve that connects head sides to shaft
    /// sides. Bigger = softer, more drawn-out flow into the key.
    private let neckHeight: CGFloat

    /// `showsShadow` adds a soft drop shadow under the balloon — used by the
    /// emoji-grid preview, whose backdrop has no key seams to anchor it.
    /// The glyph parameters let that preview scale emojis past the 32pt
    /// character cap so the balloon glyph reads larger than the grid cell's.
    init(
        showsShadow: Bool = false,
        maxLabelFontSize: CGFloat = 32,
        glyphHeightRatio: CGFloat = 0.7,
        maxHeadHeight: CGFloat? = 36,
        neckHeight: CGFloat = 12
    ) {
        self.showsShadow = showsShadow
        self.maxLabelFontSize = maxLabelFontSize
        self.glyphHeightRatio = glyphHeightRatio
        self.maxHeadHeight = maxHeadHeight
        self.neckHeight = neckHeight
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        isHidden = true
        alpha = 0
        backgroundColor = .clear

        if showsShadow {
            shapeLayer.shadowColor = UIColor.black.cgColor
            shapeLayer.shadowOpacity = 0.22
            shapeLayer.shadowRadius = 7
            shapeLayer.shadowOffset = CGSize(width: 0, height: 3)
        }
        layer.addSublayer(shapeLayer)

        label.translatesAutoresizingMaskIntoConstraints = false
        label.textAlignment = .center
        label.textColor = theme.keyText
        label.font = UIFont.systemFont(ofSize: 32, weight: .regular)
        addSubview(label)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        shapeLayer.frame = bounds
        shapeLayer.fillColor = theme.keyPopupBackground.cgColor
        let path = balloonPath()
        shapeLayer.path = path.cgPath
        if showsShadow {
            // Explicit path so Core Animation skips the per-frame alpha mask.
            shapeLayer.shadowPath = path.cgPath
        }

        // Scale the label font to whatever vertical space the head ended
        // up with — top-row balloons get a smaller head than middle rows
        // because they can't extend above the keyboard, and a fixed 32pt
        // glyph would overflow and end up clipped at the top.
        let fontSize = min(
            maxLabelFontSize,
            max(Self.minLabelFontSize, headHeight * glyphHeightRatio)
        )
        label.font = UIFont.systemFont(ofSize: fontSize, weight: .regular)

        // Label sits inside the rounded head area only.
        label.frame = CGRect(x: 0, y: 0, width: bounds.width, height: headHeight)
    }

    /// Positions the preview so its bottom edge coincides with `keyFrame.maxY`
    /// (the path includes the key footprint). For top-row keys without
    /// enough room above, the head shrinks. For keys at the left/right edge
    /// of `container`, the flare is pushed entirely to the inner side and
    /// the outer side renders as a straight line.
    /// `topLimit` is the highest Y (in `container` coords) the balloon may
    /// reach — the caller passes the record button's top edge so a top-row
    /// balloon grows right up to it and no further. Defaults to 1 pt below the
    /// container's top edge for callers (the emoji grid) that have no such
    /// ceiling.
    func show(
        character: String,
        over keyFrame: CGRect,
        in container: UIView,
        topLimit: CGFloat = 1
    ) {
        label.text = character

        let balloonWidth = max(keyFrame.width * Self.widthRatio, 44)
        let shaftH = keyFrame.height
        // Capped so the letter keyboard's balloon stays compact and uniform on
        // every row; the emoji grid passes `nil` to keep its larger head.
        let baseHeadH = max(keyFrame.height * 1.1, 50)
        let desiredHeadH = maxHeadHeight.map { min($0, baseHeadH) } ?? baseHeadH

        // A keyboard extension cannot draw above its input view's top edge —
        // the system clips anything above the keyboard, so a balloon with a
        // negative `minY` gets its head cut off (the bug on top-row keys).
        // Keep the balloon's bottom pinned to the key and, when the full-size
        // head would poke above the keyboard, shrink the head just enough to
        // fit (`minY >= topLimit`). Middle/bottom rows have room and keep the
        // full head. `layoutSubviews` scales the glyph to the resulting head
        // height, so a shrunk top-row head stays legible.
        var actualHeadH = desiredHeadH
        var totalH = actualHeadH + neckHeight + shaftH
        var minY = keyFrame.maxY - totalH
        if minY < topLimit {
            actualHeadH = max(0, keyFrame.maxY - topLimit - neckHeight - shaftH)
            totalH = actualHeadH + neckHeight + shaftH
            minY = keyFrame.maxY - totalH
        }

        // Decide horizontal placement. If natural-centered placement would
        // overflow either side, lock the balloon's outer edge to the key's
        // outer edge and let the head extend inward only.
        let naturalX = keyFrame.midX - balloonWidth / 2
        let containerWidth = container.bounds.width
        let originX: CGFloat
        if naturalX < 0 {
            leftEdgeStraight = true
            rightEdgeStraight = false
            originX = keyFrame.minX
        } else if naturalX + balloonWidth > containerWidth {
            leftEdgeStraight = false
            rightEdgeStraight = true
            originX = keyFrame.maxX - balloonWidth
        } else {
            leftEdgeStraight = false
            rightEdgeStraight = false
            originX = naturalX
        }

        keyWidth = keyFrame.width
        keyHeight = keyFrame.height
        keyOriginX = keyFrame.minX - originX
        headHeight = actualHeadH

        frame = CGRect(x: originX, y: minY, width: balloonWidth, height: totalH)

        if superview !== container {
            removeFromSuperview()
            container.addSubview(self)
        } else {
            container.bringSubviewToFront(self)
        }

        isHidden = false
        UIView.animate(withDuration: 0.04) { self.alpha = 1 }
    }

    /// Fades the preview out. Safe to call when already hidden.
    func hide() {
        UIView.animate(
            withDuration: 0.12,
            animations: { self.alpha = 0 },
            completion: { [weak self] _ in
                if self?.alpha == 0 { self?.isHidden = true }
            }
        )
    }

    // MARK: - Path

    /// Walks the outline clockwise. The right and left sides each have two
    /// variants: a "balloon" branch with rounded top corner + curve into
    /// shaft, and a "straight edge" branch used when the key sits on the
    /// keyboard's edge.
    private func balloonPath() -> UIBezierPath {
        let W = bounds.width
        let H = bounds.height
        let h = keyHeight
        let kw = keyWidth
        let kx = keyOriginX
        let kr = Self.keyCornerRadius
        let br = Self.headCornerRadius
        let tH = neckHeight
        // y where the head's straight side ends and the curve into the
        // shaft begins; transitionEndY is where the curve lands on the
        // shaft's straight side.
        let transitionStartY = H - h - tH
        let transitionEndY = H - h

        // No room for the head's top corner — fall back to a plain
        // rounded rect so the popup never disappears entirely.
        if transitionStartY < br * 1.2 {
            return UIBezierPath(roundedRect: bounds, cornerRadius: kr)
        }

        let path = UIBezierPath()

        // Top edge.
        let topLeftStart: CGFloat = leftEdgeStraight ? 0 : br
        let topRightEnd: CGFloat = rightEdgeStraight ? W : W - br
        path.move(to: CGPoint(x: topLeftStart, y: 0))
        path.addLine(to: CGPoint(x: topRightEnd, y: 0))

        // ---------- Right side ----------
        if rightEdgeStraight {
            // Outer edge runs straight from top to the key's bottom-right
            // corner — no head extension or curve on this side.
            path.addLine(to: CGPoint(x: W, y: H - kr))
        } else {
            // Top-right corner of head.
            path.addArc(withCenter: CGPoint(x: W - br, y: br), radius: br,
                        startAngle: -.pi / 2, endAngle: 0, clockwise: true)
            // Head's straight right edge down to the start of the curve.
            path.addLine(to: CGPoint(x: W, y: transitionStartY))
            // Single smooth cubic from head's right edge to the shaft's
            // right edge. Vertical tangents at both ends (control points
            // sit straight below / straight above the endpoints) so the
            // path flows seamlessly without a discrete head-bottom corner.
            path.addCurve(
                to: CGPoint(x: kx + kw, y: transitionEndY),
                controlPoint1: CGPoint(x: W, y: transitionStartY + tH * 0.55),
                controlPoint2: CGPoint(x: kx + kw, y: transitionEndY - tH * 0.55)
            )
            // Shaft's straight right edge down to the bottom corner.
            path.addLine(to: CGPoint(x: kx + kw, y: H - kr))
        }

        // ---------- Key bottom corners + bottom edge ----------
        path.addArc(withCenter: CGPoint(x: kx + kw - kr, y: H - kr), radius: kr,
                    startAngle: 0, endAngle: .pi / 2, clockwise: true)
        path.addLine(to: CGPoint(x: kx + kr, y: H))
        path.addArc(withCenter: CGPoint(x: kx + kr, y: H - kr), radius: kr,
                    startAngle: .pi / 2, endAngle: .pi, clockwise: true)

        // ---------- Left side ----------
        if leftEdgeStraight {
            path.addLine(to: CGPoint(x: 0, y: 0))
        } else {
            // Shaft's straight left edge up to the curve.
            path.addLine(to: CGPoint(x: kx, y: transitionEndY))
            // Mirror cubic: shaft left edge → head left edge.
            path.addCurve(
                to: CGPoint(x: 0, y: transitionStartY),
                controlPoint1: CGPoint(x: kx, y: transitionEndY - tH * 0.55),
                controlPoint2: CGPoint(x: 0, y: transitionStartY + tH * 0.55)
            )
            // Head's straight left edge up to the top corner.
            path.addLine(to: CGPoint(x: 0, y: br))
            path.addArc(withCenter: CGPoint(x: br, y: br), radius: br,
                        startAngle: .pi, endAngle: 3 * .pi / 2, clockwise: true)
        }

        path.close()
        return path
    }
}
