import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { getAnalyticsContext, trackEvent } from '../../utils/analytics';
import { trackButtonClick } from '../../core/observability';

export function SecondaryButton({ title, onPress, style, testID }) {
  // BLOCO 3: Microinterações - Button press feedback
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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
    const analyticsContext = getAnalyticsContext();
    const buttonId = String(testID || title || 'secondary-button');
    const screen = String(analyticsContext?.screen || 'unknown');

    trackButtonClick({
      screen,
      id: buttonId,
      label: String(title || ''),
      component: 'SecondaryButton',
    });

    trackEvent('tap', {
      screen,
      meta: {
        allowBurst: true,
        component: 'SecondaryButton',
        domain: 'interaction',
        id: buttonId,
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
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: colors.surfaceElevated,
  },
  text: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
