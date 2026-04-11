import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { trackEvent } from '../../utils/analytics';

export function PrimaryButton({ title, onPress, style, testID }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = React.useCallback(() => {
    trackEvent('tap', {
      screen: 'ui',
      meta: {
        allowBurst: true,
        component: 'PrimaryButton',
        domain: 'interaction',
        id: String(testID || title || 'primary-button'),
        label: String(title || ''),
      },
    });

    if (typeof onPress === 'function') {
      onPress();
    }
  }, [onPress, testID, title]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity testID={testID} onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.button, style]}>
        <Text style={styles.text}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  text: {
    ...typography.cta,
  },
});
