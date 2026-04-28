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
    // BLOCO 5: UI Premium - Subtle shadows increased
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  cardElevated: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.border,
    // BLOCO 5: Premium elevated shadows
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  cardAccent: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
});
