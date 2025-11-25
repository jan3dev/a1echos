import React from 'react';
import { Button as RNButton, StyleSheet, View } from 'react-native';
import { Toast, ToastVariant } from './Toast';
import { useToast } from './useToast';

export default {
  title: 'Toast',
  component: Toast,
};

const ToastDemo = ({
  variant,
  withPrimaryButton,
  withSecondaryButton,
}: {
  variant: ToastVariant;
  withPrimaryButton?: boolean;
  withSecondaryButton?: boolean;
}) => {
  const { show, toastState } = useToast();

  const handleShow = () => {
    show({
      title: 'Toast Title',
      message: 'This is a toast message with some descriptive text.',
      variant,
      primaryButtonText: withPrimaryButton ? 'Primary' : undefined,
      onPrimaryButtonTap: withPrimaryButton
        ? () => console.log('Primary tapped')
        : undefined,
      secondaryButtonText: withSecondaryButton ? 'Secondary' : undefined,
      onSecondaryButtonTap: withSecondaryButton
        ? () => console.log('Secondary tapped')
        : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Toast" onPress={handleShow} />
      <Toast {...toastState} />
    </View>
  );
};

export const Informative = () => <ToastDemo variant="informative" />;

export const Warning = () => <ToastDemo variant="warning" />;

export const Danger = () => <ToastDemo variant="danger" />;

export const WithPrimaryButton = () => (
  <ToastDemo variant="informative" withPrimaryButton />
);

export const WithBothButtons = () => (
  <ToastDemo variant="warning" withPrimaryButton withSecondaryButton />
);

export const LongText = () => {
  const { show, toastState } = useToast();

  const handleShow = () => {
    show({
      title: 'This is a very long title that might wrap to multiple lines',
      message:
        'This is a very long message with lots of descriptive text that will definitely wrap to multiple lines to test the layout.',
      variant: 'danger',
      titleMaxLines: 3,
      messageMaxLines: 5,
      primaryButtonText: 'Got it',
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Toast with Long Text" onPress={handleShow} />
      <Toast {...toastState} />
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
});
