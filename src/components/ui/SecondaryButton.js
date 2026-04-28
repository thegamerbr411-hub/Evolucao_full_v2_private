import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { trackEvent } from '../../utils/analytics';

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
