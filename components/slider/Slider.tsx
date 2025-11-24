import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { AquaTypography } from '../../theme/typography';
import { Icon } from '../icon';
import { ProgressIndicator } from '../progress';

export type SliderState = 'initial' | 'inProgress' | 'completed' | 'error';

interface SliderProps {
  width: number;
  height?: number;
  text?: string;
  onConfirm: () => void;
  enabled?: boolean;
  thumbWidth?: number;
  thumbHeight?: number;
  sliderState?: SliderState;
}

const SLIDER_TRIGGER_THRESHOLD = 0.75;
const SLIDER_ANIMATION_DURATION = 600;
const SLIDER_DEFAULT_THUMB_SIZE = 56;

export const Slider = ({
  width,
  height = SLIDER_DEFAULT_THUMB_SIZE,
  text = '',
  onConfirm,
  enabled = true,
  thumbWidth = SLIDER_DEFAULT_THUMB_SIZE,
  thumbHeight = SLIDER_DEFAULT_THUMB_SIZE,
  sliderState = 'initial',
}: SliderProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const positionAnim = useRef(new Animated.Value(0)).current;

  const SLIDER_PADDING = 2;

  const maxSlidePosition = useMemo(
    () => Math.max(1, width - thumbWidth - SLIDER_PADDING),
    [width, thumbWidth]
  );

  const prevSliderStateRef = useRef(sliderState);

  useEffect(() => {
    const prevState = prevSliderStateRef.current;
    prevSliderStateRef.current = sliderState;

    if (prevState !== 'initial' && sliderState === 'initial') {
      setPosition(0);
      positionRef.current = 0;
      Animated.timing(positionAnim, {
        toValue: 0,
        duration: SLIDER_ANIMATION_DURATION,
        useNativeDriver: false,
      }).start();
    }
  }, [sliderState, positionAnim]);

  const getPosition = useCallback(() => {
    if (position < 0) return 0;
    if (position > maxSlidePosition) return maxSlidePosition;
    return position;
  }, [position, maxSlidePosition]);

  const currentPosition = useMemo(() => getPosition(), [getPosition]);
  const percent = useMemo(
    () => currentPosition / maxSlidePosition,
    [currentPosition, maxSlidePosition]
  );
  const textOpacity = useMemo(
    () => 1.0 - Math.min(Math.max(percent * 2, 0), 1.0),
    [percent]
  );

  const sliderReleased = useCallback(() => {
    const currentPos = positionRef.current;
    const triggerThreshold = maxSlidePosition * SLIDER_TRIGGER_THRESHOLD;

    if (currentPos > triggerThreshold) {
      const newPos = maxSlidePosition;
      setPosition(newPos);
      positionRef.current = newPos;
      Animated.timing(positionAnim, {
        toValue: newPos,
        duration: SLIDER_ANIMATION_DURATION,
        useNativeDriver: false,
      }).start(() => {
        onConfirm();
      });
    } else {
      setPosition(0);
      positionRef.current = 0;
      Animated.timing(positionAnim, {
        toValue: 0,
        duration: SLIDER_ANIMATION_DURATION,
        useNativeDriver: false,
      }).start();
    }
  }, [maxSlidePosition, onConfirm, positionAnim]);

  const canInteract = enabled && sliderState === 'initial';
  const canInteractRef = useRef(canInteract);
  canInteractRef.current = canInteract;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canInteractRef.current,
        onMoveShouldSetPanResponder: () => canInteractRef.current,
        onPanResponderMove: (_, gestureState) => {
          if (!canInteractRef.current) return;
          const newPos = gestureState.dx * 2.5;
          const clampedPos = Math.max(0, Math.min(newPos, maxSlidePosition));

          setPosition(clampedPos);
          positionRef.current = clampedPos;
          positionAnim.setValue(clampedPos);
        },
        onPanResponderRelease: sliderReleased,
        onPanResponderTerminate: sliderReleased,
      }),
    [maxSlidePosition, sliderReleased, positionAnim]
  );

  const backgroundColor = useMemo(() => {
    if (!enabled) {
      return `${colors.surfaceInverse}80`;
    }
    if (!isFinite(percent)) {
      return `${colors.accentBrand}29`;
    }
    // 0.16 opacity * 255 = ~41
    const opacityHex = Math.round(41 * (1 - percent))
      .toString(16)
      .padStart(2, '0');
    return `${colors.accentBrand}${opacityHex}`;
  }, [percent, enabled, colors.accentBrand, colors.surfaceInverse]);

  const renderThumb = () => {
    switch (sliderState) {
      case 'initial':
        return <Icon name="arrow_right" size={24} color={colors.textInverse} />;
      case 'inProgress':
        return (
          <View style={styles.thumbCenter}>
            <ProgressIndicator size={24} color={colors.textInverse} />
          </View>
        );
      case 'completed':
        return <Icon name="check" size={24} color={colors.textInverse} />;
      case 'error':
        return <Icon name="close" size={24} color={colors.textInverse} />;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor,
        },
      ]}
    >
      <View
        style={[styles.labelContainer, { left: thumbWidth }]}
        pointerEvents="none"
      >
        <View style={{ opacity: textOpacity }}>
          <Text
            style={[
              AquaTypography.body1SemiBold,
              {
                color: enabled
                  ? colors.accentBrand
                  : `${colors.textSecondary}80`,
              },
            ]}
          >
            {text}
          </Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.backgroundFill,
          {
            width: Animated.add(positionAnim, thumbWidth),
            height,
            backgroundColor: colors.accentBrand,
          },
        ]}
      >
        <View
          style={[
            styles.thumb,
            {
              opacity: enabled ? 1 : 0.5,
            },
          ]}
          pointerEvents="none"
        >
          {renderThumb()}
        </View>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumbTouchArea,
          {
            left: positionAnim,
            width: thumbWidth,
            height: thumbHeight,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  labelContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  backgroundFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 8,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  thumbCenter: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbTouchArea: {
    position: 'absolute',
    top: 0,
    zIndex: 3,
  },
});
