import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLoc } from '../../../hooks/useLoc';
import { useTheme } from '../../../theme';
import { Button } from '../../ui/button';
import { Icon } from '../../ui/icon';
import { Text } from '../../ui/text';

interface ErrorViewProps {
  errorMessage: string;
  onRetry?: () => void;
}

export const ErrorView = ({ errorMessage, onRetry }: ErrorViewProps) => {
  const { theme } = useTheme();
  const { loc } = useLoc();
  const colors = theme.colors;

  return (
    <View style={styles.container}>
      <Icon name="warning" size={48} color={colors.accentWarning} />
      <View style={styles.messageSpacing} />
      <Text
        variant="body1"
        weight="medium"
        color={colors.textPrimary}
        align="center"
      >
        {loc.errorPrefix} {errorMessage}
      </Text>
      {onRetry && (
        <>
          <View style={styles.buttonSpacing} />
          <Button.primary text={loc.retry} onPress={onRetry} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  messageSpacing: {
    height: 16,
  },
  buttonSpacing: {
    height: 24,
  },
});
