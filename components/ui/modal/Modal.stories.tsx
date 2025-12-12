import { Button as RNButton, StyleSheet, View } from 'react-native';

import { Icon, Modal, ModalVariant, useModal } from '@/components';
import { useTheme } from '@/theme';

export default {
  title: 'UI Components/Modal',
  component: Modal,
};

const ModalDemo = ({
  iconVariant,
  withIcon,
  withSecondaryButton,
  withTertiaryMessage,
}: {
  iconVariant: ModalVariant;
  withIcon?: boolean;
  withSecondaryButton?: boolean;
  withTertiaryMessage?: boolean;
}) => {
  const { show, modalState } = useModal();
  const { theme } = useTheme();

  const handleShow = () => {
    show({
      title: 'Modal Title',
      message: 'This is a modal message with some descriptive text.',
      messageTertiary: withTertiaryMessage
        ? 'This is an important tertiary message'
        : undefined,
      primaryButton: {
        text: 'Primary Action',
        onTap: () => console.log('Primary tapped'),
        variant: 'normal',
      },
      secondaryButton: withSecondaryButton
        ? {
            text: 'Secondary Action',
            onTap: () => console.log('Secondary tapped'),
            variant: 'normal',
          }
        : undefined,
      icon: withIcon ? (
        <Icon name="warning" size={24} color={theme.colors.textPrimary} />
      ) : undefined,
      iconVariant,
    });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <RNButton title="Show Modal" onPress={handleShow} />
      <Modal {...modalState} />
    </View>
  );
};

export const Normal = () => <ModalDemo iconVariant="normal" withIcon />;

export const Success = () => <ModalDemo iconVariant="success" withIcon />;

export const Danger = () => <ModalDemo iconVariant="danger" withIcon />;

export const Warning = () => <ModalDemo iconVariant="warning" withIcon />;

export const Info = () => <ModalDemo iconVariant="info" withIcon />;

export const WithSecondaryButton = () => (
  <ModalDemo iconVariant="normal" withIcon withSecondaryButton />
);

export const WithTertiaryMessage = () => (
  <ModalDemo iconVariant="danger" withIcon withTertiaryMessage />
);

export const WithIllustration = () => {
  const { show, modalState } = useModal();
  const { theme } = useTheme();

  const handleShow = () => {
    show({
      title: 'Welcome',
      message: 'This modal has an illustration instead of an icon.',
      primaryButton: {
        text: 'Get Started',
        onTap: () => console.log('Get started'),
        variant: 'normal',
      },
      illustration: (
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: theme.colors.surfaceTertiary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="warning" size={48} color={theme.colors.accentBrand} />
        </View>
      ),
    });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <RNButton title="Show Modal with Illustration" onPress={handleShow} />
      <Modal {...modalState} />
    </View>
  );
};

export const LongText = () => {
  const { show, modalState } = useModal();
  const { theme } = useTheme();

  const handleShow = () => {
    show({
      title: 'This is a very long title that might wrap to multiple lines',
      message:
        'This is a very long message with lots of descriptive text that will definitely wrap to multiple lines to demonstrate the layout behavior in the modal.',
      primaryButton: {
        text: 'Got it',
        onTap: () => console.log('Got it'),
        variant: 'normal',
      },
      secondaryButton: {
        text: 'Cancel',
        onTap: () => console.log('Cancel'),
        variant: 'normal',
      },
      icon: <Icon name="warning" size={24} color={theme.colors.textPrimary} />,
      iconVariant: 'warning',
      titleMaxLines: 5,
      messageMaxLines: 10,
    });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <RNButton title="Show Modal with Long Text" onPress={handleShow} />
      <Modal {...modalState} />
    </View>
  );
};

export const DangerWithButtons = () => {
  const { show, modalState } = useModal();
  const { theme } = useTheme();

  const handleShow = () => {
    show({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account?',
      messageTertiary: 'This action cannot be undone.',
      primaryButton: {
        text: 'Delete',
        onTap: () => console.log('Delete confirmed'),
        variant: 'error',
      },
      secondaryButton: {
        text: 'Cancel',
        onTap: () => console.log('Cancel'),
        variant: 'normal',
      },
      icon: <Icon name="danger" size={24} color={theme.colors.textPrimary} />,
      iconVariant: 'danger',
    });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <RNButton title="Show Danger Modal" onPress={handleShow} />
      <Modal {...modalState} />
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
