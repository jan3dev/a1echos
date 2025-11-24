import React from 'react';
import {
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../text/Text';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  contentWidget?: React.ReactNode;
  titleTrailing?: string;
  subtitleTrailing?: string;
  titleColor?: string;
  subtitleColor?: string;
  titleTrailingColor?: string;
  subtitleTrailingColor?: string;
  backgroundColor?: string;
  iconLeading?: React.ReactNode;
  iconTrailing?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  titleMaxLines?: number;
  subtitleMaxLines?: number;
  style?: StyleProp<ViewStyle>;
}

export const ListItem = ({
  title,
  subtitle,
  contentWidget,
  titleTrailing,
  subtitleTrailing,
  titleColor,
  subtitleColor,
  titleTrailingColor,
  subtitleTrailingColor,
  backgroundColor,
  iconLeading,
  iconTrailing,
  selected,
  onPress,
  titleMaxLines = 2,
  subtitleMaxLines = 3,
  style,
}: ListItemProps) => {
  const { theme } = useTheme();

  const containerStyle: ViewStyle = {
    backgroundColor: backgroundColor ?? theme.colors.surfacePrimary,
  };

  const innerStyle: ViewStyle = {
    backgroundColor: selected ? theme.colors.surfaceSelected : undefined,
    borderColor: selected ? theme.colors.surfaceBorderSelected : 'transparent',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  };

  return (
    <View style={[styles.card, containerStyle, style]}>
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={selected ? 1 : 0.7}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ selected: !!selected, disabled: !onPress }}
      >
        <View style={styles.paddingWrapper}>
          <View style={innerStyle}>
            {iconLeading && (
              <View style={styles.leadingContainer}>{iconLeading}</View>
            )}

            <View style={styles.contentContainer}>
              <Text
                variant="body1"
                weight="semibold"
                color={titleColor}
                numberOfLines={titleMaxLines}
              >
                {title}
              </Text>

              {contentWidget ? (
                contentWidget
              ) : subtitle ? (
                <Text
                  variant="body2"
                  weight="medium"
                  color={subtitleColor ?? theme.colors.textSecondary}
                  numberOfLines={subtitleMaxLines}
                  style={styles.subtitle}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View style={styles.trailingTextContainer}>
              {titleTrailing && (
                <Text
                  variant="body1"
                  weight="semibold"
                  color={titleTrailingColor}
                  align="right"
                >
                  {titleTrailing}
                </Text>
              )}
              {subtitleTrailing && (
                <Text
                  variant="body2"
                  weight="medium"
                  color={subtitleTrailingColor ?? theme.colors.textSecondary}
                  align="right"
                  style={styles.subtitle}
                >
                  {subtitleTrailing}
                </Text>
              )}
            </View>

            {iconTrailing && (
              <View style={styles.trailingIconContainer}>{iconTrailing}</View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {},
  paddingWrapper: {
    padding: 4,
  },
  leadingContainer: {
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 0,
  },
  trailingTextContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  trailingIconContainer: {
    marginLeft: 16,
  },
});
