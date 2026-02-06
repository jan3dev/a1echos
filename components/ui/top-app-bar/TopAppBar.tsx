import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Fragment, ReactNode } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTheme } from '@/models';
import { useTheme, useThemeStore } from '@/theme';

import { Icon } from '../icon/Icon';
import { Text } from '../text/Text';

export interface TopAppBarProps {
  title?: string;
  showBackButton?: boolean;
  leading?: ReactNode;
  onBackPressed?: () => void;
  onTitlePressed?: () => void;
  onTitleLongPressed?: () => void;
  titleWidget?: ReactNode;
  actions?: ReactNode[];
  transparent?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIDE_WIDTH = 64; // 2 × 24px icon + 16px gap

export const TopAppBar = ({
  title = '',
  showBackButton = true,
  leading,
  onBackPressed,
  onTitlePressed,
  onTitleLongPressed,
  titleWidget,
  actions = [],
  transparent = false,
  style,
}: TopAppBarProps) => {
  const { theme } = useTheme();
  const { currentTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const blurTint = currentTheme === AppTheme.DARK ? 'dark' : 'light';

  const handleBack = () => {
    if (onBackPressed) {
      onBackPressed();
    } else {
      router.back();
    }
  };

  const APP_BAR_HEIGHT = 60;
  const topPadding = insets.top;
  const totalHeight = APP_BAR_HEIGHT + topPadding;

  const backgroundColor = transparent
    ? 'transparent'
    : theme.colors.glassBackground;

  const renderContent = () => (
    <View
      style={[
        styles.contentContainer,
        {
          paddingTop: topPadding + 16,
          height: totalHeight,
          backgroundColor: transparent ? 'transparent' : undefined,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.leadingContainer}>
          {showBackButton ? (
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="chevron_left"
                size={24}
                color={
                  transparent
                    ? theme.colors.textInverse
                    : theme.colors.textPrimary
                }
              />
            </TouchableOpacity>
          ) : leading ? (
            leading
          ) : null}
        </View>

        <View style={styles.titleContainer}>
          <TouchableOpacity
            onPress={onTitlePressed}
            onLongPress={onTitleLongPressed}
            disabled={!onTitlePressed && !onTitleLongPressed}
          >
            {titleWidget ?? (
              <Text
                variant="subtitle"
                weight="semibold"
                align="center"
                color={
                  transparent
                    ? theme.colors.textInverse
                    : theme.colors.textPrimary
                }
              >
                {title}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionsContainer}>
          {actions.map((action, index) => (
            <Fragment key={index}>
              {action}
              {index < actions.length - 1 && <View style={{ width: 16 }} />}
            </Fragment>
          ))}
        </View>
      </View>
    </View>
  );

  const containerStyles = [
    styles.container,
    {
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      overflow: 'hidden' as const,
    },
    style,
  ];

  if (transparent) {
    return <View style={containerStyles}>{renderContent()}</View>;
  }

  return (
    <View style={containerStyles}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={20}
          tint={blurTint}
          style={[StyleSheet.absoluteFill, { backgroundColor }]}
        />
      ) : (
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={50}
          tint={blurTint}
          style={[StyleSheet.absoluteFill, { backgroundColor }]}
        />
      )}
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  contentContainer: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leadingContainer: {
    width: SIDE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    width: SIDE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
