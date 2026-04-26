import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export default function StreakBar({ streak = 0 }) {
  const safeStreak = Math.max(0, Number(streak) || 0);
  const fillWidth = Math.min(safeStreak * 20, 240);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>🔥 {safeStreak} {safeStreak === 1 ? 'dia' : 'dias'} de streak</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    alignItems: 'center',
  },
  label: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  track: {
    width: 240,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: colors.warning,
    borderRadius: 4,
  },
});
