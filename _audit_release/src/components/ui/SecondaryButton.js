import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { trackEvent } from '../../utils/analytics';

export function SecondaryButton({ title, onPress, style, testID }) {
  const handlePress = React.useCallback(() => {
    trackEvent('tap', {
      screen: 'ui',
      meta: {
        allowBurst: true,
        component: 'SecondaryButton',
        domain: 'interaction',
        id: String(testID || title || 'secondary-button'),
        label: String(title || ''),
      },
    });

    if (typeof onPress === 'function') {
      onPress();
    }
  }, [onPress, testID, title]);

  return (
    <TouchableOpacity testID={testID} onPress={handlePress} style={[styles.button, style]}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: 'transparent',
  },
  text: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
