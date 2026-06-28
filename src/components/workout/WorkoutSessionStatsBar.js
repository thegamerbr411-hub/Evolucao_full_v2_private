import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export function WorkoutSessionStatsBar({ durationLabel, setsLabel, exerciseLabel }) {
  return (
    <View testID="workout-session-stats-bar" style={styles.wrap}>
      <View style={styles.cell}>
        <Text style={styles.label}>Duracao</Text>
        <Text testID="workout-session-duration" style={styles.value}>{durationLabel}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={styles.label}>Series</Text>
        <Text testID="workout-session-sets" style={styles.value}>{setsLabel}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={styles.label}>Exercicio</Text>
        <Text testID="workout-session-exercise-progress" style={styles.value}>{exerciseLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated || colors.card,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
