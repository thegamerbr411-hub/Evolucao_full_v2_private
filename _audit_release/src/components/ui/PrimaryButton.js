import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { getAnalyticsContext, trackEvent } from '../../utils/analytics';
import { trackButtonClick } from '../../core/observability';

export function PrimaryButton({ title, onPress, style, testID, ...touchableRest }) {
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
    const analyticsContext = getAnalyticsContext();
    const buttonId = String(testID || title || 'primary-button');
    const screen = String(analyticsContext?.screen || 'unknown');

    trackButtonClick({
      screen,
      id: buttonId,
      label: String(title || ''),
      component: 'PrimaryButton',
    });

    trackEvent('tap', {
      screen,
      meta: {
        allowBurst: true,
        component: 'PrimaryButton',
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
      <TouchableOpacity
        {...touchableRest}
        testID={testID}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, style]}
      >
        <Text style={styles.text}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    ...typography.cta,
  },
});
