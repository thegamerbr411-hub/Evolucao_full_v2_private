import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export function AppCard({ children, style, testID, elevated = false, accent = false }) {
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
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  cardElevated: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.border,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  cardAccent: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
});
