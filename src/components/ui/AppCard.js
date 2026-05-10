import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export function AppCard({ children, style, testID, elevated = false, accent = false, variant = 'default' }) {
  // BLOCO 3: Microinterações - Fade-in entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.card,
        variant === 'secondary' && styles.cardSecondary,
        variant === 'empty' && styles.cardEmpty,
        variant === 'hero' && styles.cardHero,
        elevated && styles.cardElevated,
        accent && styles.cardAccent,
        style,
        { opacity: fadeAnim },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  cardSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    shadowOpacity: 0.16,
  },
  cardEmpty: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.outlineStrong,
    borderStyle: 'dashed',
  },
  cardHero: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.outlineStrong,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 7,
  },
  cardElevated: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.outlineStrong,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  cardAccent: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
});
