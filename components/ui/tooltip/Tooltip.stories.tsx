import React from 'react';
import { Button as RNButton, StyleSheet, View } from 'react-native';
import { Tooltip, TooltipPointerPosition, TooltipVariant } from './Tooltip';
import { useTooltip } from './useTooltip';

export default {
  title: 'UI Components/Tooltip',
  component: Tooltip,
};

const TooltipDemo = ({
  variant,
  pointerPosition,
  isDismissible,
  isInfo,
}: {
  variant: TooltipVariant;
  pointerPosition?: TooltipPointerPosition;
  isDismissible?: boolean;
  isInfo?: boolean;
}) => {
  const { show, tooltipState } = useTooltip();

  const handleShow = () => {
    show({
      message: 'This is a tooltip message',
      variant,
      pointerPosition,
      isDismissible,
      isInfo,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Tooltip" onPress={handleShow} />
      <View style={styles.tooltipContainer}>
        <Tooltip {...tooltipState} />
      </View>
    </View>
  );
};

export const Normal = () => <TooltipDemo variant="normal" />;

export const Success = () => <TooltipDemo variant="success" />;

export const Warning = () => <TooltipDemo variant="warning" />;

export const Error = () => <TooltipDemo variant="error" />;

export const WithTopPointer = () => (
  <TooltipDemo variant="normal" pointerPosition="top" />
);

export const WithBottomPointer = () => (
  <TooltipDemo variant="normal" pointerPosition="bottom" />
);

export const Dismissible = () => (
  <TooltipDemo variant="warning" isDismissible />
);

export const InfoMode = () => (
  <TooltipDemo variant="normal" isInfo isDismissible />
);

export const InfoModeWithVariants = () => {
  const { show, tooltipState } = useTooltip();

  const variants: TooltipVariant[] = ['success', 'warning', 'error'];
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handleShow = () => {
    const variant = variants[currentIndex];
    show({
      message: `This is a ${variant} info tooltip`,
      variant,
      isInfo: true,
      isDismissible: true,
    });
    setCurrentIndex((currentIndex + 1) % variants.length);
  };

  return (
    <View style={styles.container}>
      <RNButton
        title="Show Info Tooltip (Cycle Variants)"
        onPress={handleShow}
      />
      <View style={styles.tooltipContainer}>
        <Tooltip {...tooltipState} />
      </View>
    </View>
  );
};

export const LongMessage = () => {
  const { show, tooltipState } = useTooltip();

  const handleShow = () => {
    show({
      message:
        'This is a very long tooltip message that will wrap to multiple lines to demonstrate the layout behavior.',
      variant: 'normal',
      isDismissible: true,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Long Tooltip" onPress={handleShow} />
      <View style={styles.tooltipContainer}>
        <Tooltip {...tooltipState} />
      </View>
    </View>
  );
};

export const AutoDismiss = () => {
  const { show, tooltipState } = useTooltip();

  const handleShow = () => {
    show({
      message: 'This tooltip will auto-dismiss in 2 seconds',
      variant: 'success',
      duration: 2000,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Auto-Dismiss Tooltip" onPress={handleShow} />
      <View style={styles.tooltipContainer}>
        <Tooltip {...tooltipState} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
