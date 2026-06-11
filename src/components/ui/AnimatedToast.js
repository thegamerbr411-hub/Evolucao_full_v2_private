import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export function AnimatedToast({ message, onHide, duration = 1700 }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    let hideTimeout;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -20,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (typeof onHide === 'function') {
            onHide();
          }
        });
      }, duration);
    });

    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [message, duration, onHide, opacity, translateY]);

  if (!message) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing.xs,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  toast: {
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    maxWidth: '86%',
  },
  text: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
  },
});