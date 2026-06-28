import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import {
  buildRestTimerActionLabels,
  buildRestTimerStatusCopy,
  formatRestTimerCountdown,
} from '../../services/workoutRestTimerCopy.js';

export function WorkoutRestTimerCard({
  secondsRemaining = 0,
  isRunning = false,
  onSkip,
  onPlus15,
  onMinus15,
}) {
  if (!isRunning) {
    return null;
  }

  const labels = buildRestTimerActionLabels();
  const { statusCopy, isLowTime } = buildRestTimerStatusCopy({
    secondsRemaining,
    isRunning,
  });
  const countdownLabel = formatRestTimerCountdown(secondsRemaining);

  return (
    <View testID="workout-rest-timer-card" style={styles.card}>
      <Text style={styles.title}>{labels.title}</Text>
      <Text
        testID="workout-rest-timer-countdown"
        style={[styles.countdown, isLowTime ? styles.countdownLow : null]}
      >
        {countdownLabel}
      </Text>
      {statusCopy ? (
        <Text testID="rest-timer-status-copy" style={styles.statusCopy}>
          {statusCopy}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <TouchableOpacity
          testID="btn-rest-timer-minus-15"
          style={styles.adjustBtn}
          onPress={onMinus15}
          accessibilityRole="button"
          accessibilityLabel={labels.minus15}
        >
          <Text style={styles.adjustText}>{labels.minus15}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-rest-timer-plus-15"
          style={styles.adjustBtn}
          onPress={onPlus15}
          accessibilityRole="button"
          accessibilityLabel={labels.plus15}
        >
          <Text style={styles.adjustText}>{labels.plus15}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-rest-timer-skip"
          style={styles.skipBtn}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={labels.skip}
        >
          <Text style={styles.skipText}>{labels.skip}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated || colors.card,
    gap: spacing.xs,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countdown: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  countdownLow: {
    color: colors.danger,
  },
  statusCopy: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  adjustBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustText: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  skipBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerMuted || colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 12,
  },
});
