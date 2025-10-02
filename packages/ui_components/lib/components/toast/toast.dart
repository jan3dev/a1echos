import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

enum AquaToastVariant { informative, warning, danger }

class AquaToast extends StatelessWidget {
  const AquaToast({
    super.key,
    required this.title,
    required this.message,
    this.primaryButtonText,
    this.onPrimaryButtonTap,
    this.secondaryButtonText,
    this.onSecondaryButtonTap,
    this.iconVariant = AquaToastVariant.informative,
    this.titleMaxLines = 1,
    this.messageMaxLines = 2,
    required this.colors,
  })  : assert(
          primaryButtonText == null || onPrimaryButtonTap != null,
          'If primaryButtonText is not null, onPrimaryButtonTap cannot be null',
        ),
        assert(
          secondaryButtonText == null || primaryButtonText != null,
          'If secondaryButtonText is not null, primaryButtonText cannot be null',
        );

  final String title;
  final String message;
  final String? primaryButtonText;
  final VoidCallback? onPrimaryButtonTap;
  final String? secondaryButtonText;
  final VoidCallback? onSecondaryButtonTap;
  final AquaToastVariant iconVariant;
  final int titleMaxLines;
  final int messageMaxLines;
  final AquaColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(
        bottom: 20,
        left: context.isSmallMobile || context.isMobile ? 16 : 0,
        right: context.isSmallMobile || context.isMobile ? 16 : 0,
      ),
      child: Card(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: colors.glassSurface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(8)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(8),
                  topRight: Radius.circular(8),
                  bottomLeft:
                      (primaryButtonText == null && secondaryButtonText == null)
                          ? Radius.circular(8)
                          : Radius.circular(0),
                  bottomRight:
                      (primaryButtonText == null && secondaryButtonText == null)
                          ? Radius.circular(8)
                          : Radius.circular(0),
                ),
                color: colors.surfacePrimary,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  switch (iconVariant) {
                    AquaToastVariant.danger => AquaIcon.danger(
                        color: colors.accentDanger,
                        size: 18,
                      ),
                    AquaToastVariant.warning => AquaIcon.warning(
                        color: colors.accentWarning,
                        size: 18,
                      ),
                    _ => AquaIcon.warning(color: colors.textPrimary, size: 18),
                  },
                  SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AquaText.body1SemiBold(
                        text: title,
                        color: colors.textPrimary,
                        maxLines: titleMaxLines,
                        textAlign: TextAlign.start,
                      ),
                      SizedBox(height: 4),
                      AquaText.body2Medium(
                        text: message,
                        color: colors.textPrimary.withValues(alpha: 0.80),
                        maxLines: messageMaxLines,
                        textAlign: TextAlign.start,
                      ),
                    ],
                  ),
                  const Spacer(),
                  AquaIcon.close(
                    color: colors.textPrimary.withValues(alpha: 0.50),
                    size: 18,
                    onTap: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: colors.glassSurface,
                border: (primaryButtonText == null &&
                        secondaryButtonText == null)
                    ? null
                    : Border(
                        top: BorderSide(color: Colors.transparent, width: 1),
                      ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(8),
                  bottomRight: Radius.circular(8),
                ),
              ),
              child: (primaryButtonText != null && secondaryButtonText != null)
                  ? Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: onSecondaryButtonTap,
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border(
                                  right: BorderSide(
                                    color: Colors.transparent,
                                    width: 0.5,
                                  ),
                                ),
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(16.0),
                                decoration: BoxDecoration(
                                  color: colors.surfacePrimary,
                                  borderRadius: BorderRadius.only(
                                    bottomLeft: Radius.circular(8),
                                  ),
                                ),
                                child: Center(
                                  child: AquaText.body2SemiBold(
                                    text: secondaryButtonText ?? '',
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: onPrimaryButtonTap,
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border(
                                  right: BorderSide(
                                    color: Colors.transparent,
                                    width: 0.5,
                                  ),
                                ),
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(16.0),
                                decoration: BoxDecoration(
                                  color: colors.surfacePrimary,
                                  borderRadius: BorderRadius.only(
                                    bottomRight: Radius.circular(8),
                                  ),
                                ),
                                child: Center(
                                  child: AquaText.body2SemiBold(
                                    text: primaryButtonText ?? '',
                                    color: colors.textPrimary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    )
                  : (primaryButtonText != null)
                      ? GestureDetector(
                          onTap: onPrimaryButtonTap,
                          child: Container(
                            padding: const EdgeInsets.all(16.0),
                            decoration: BoxDecoration(
                              color: colors.surfacePrimary,
                              borderRadius: BorderRadius.only(
                                bottomRight: Radius.circular(8),
                                bottomLeft: Radius.circular(8),
                              ),
                            ),
                            child: Center(
                              child: AquaText.body2SemiBold(
                                text: primaryButtonText ?? '',
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                        )
                      : SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  static void show(
    BuildContext context, {
    required String title,
    required String message,
    String? primaryButtonText,
    VoidCallback? onPrimaryButtonTap,
    String? secondaryButtonText,
    VoidCallback? onSecondaryButtonTap,
    AquaToastVariant iconVariant = AquaToastVariant.informative,
    required AquaColors colors,
  }) {
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      constraints: context.isDesktop || context.isTablet
          ? const BoxConstraints(maxWidth: 343)
          : null,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
      ),
      enableDrag: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: AquaToast(
          title: title,
          message: message,
          colors: colors,
          primaryButtonText: primaryButtonText,
          onPrimaryButtonTap: onPrimaryButtonTap,
          secondaryButtonText: secondaryButtonText,
          onSecondaryButtonTap: onSecondaryButtonTap,
          iconVariant: iconVariant,
        ),
      ),
    );
  }
}
