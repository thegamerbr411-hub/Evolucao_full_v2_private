import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import {
  EXERCISE_DEMO_COMING_SOON,
  EXERCISE_DEMO_COMING_SOON_HINT,
  formatMuscleLabel,
  getExerciseMuscleKey,
} from '../../utils/exerciseMedia';
import { formatExerciseName } from '../../utils/displayText';

const MUSCLE_ACCENT = {
  chest: ['#1e3a5f', '#2563eb'],
  back: ['#134e4a', '#0d9488'],
  shoulders: ['#4c1d95', '#7c3aed'],
  biceps: ['#713f12', '#ca8a04'],
  triceps: ['#7c2d12', '#ea580c'],
  legs: ['#14532d', '#16a34a'],
  hamstrings: ['#3f6212', '#65a30d'],
  glutes: ['#831843', '#db2777'],
  calves: ['#1e40af', '#38bdf8'],
  core: ['#334155', '#64748b'],
  default: ['#1e293b', '#475569'],
};

const MUSCLE_ICON = {
  chest: 'barbell-outline',
  back: 'body-outline',
  shoulders: 'accessibility-outline',
  biceps: 'fitness-outline',
  triceps: 'fitness-outline',
  legs: 'walk-outline',
  hamstrings: 'walk-outline',
  glutes: 'ellipse-outline',
  calves: 'footsteps-outline',
  core: 'shield-checkmark-outline',
  default: 'barbell-outline',
};

export function ExerciseMediaFallback({
  exercise,
  compact = false,
  showComingSoon = true,
  testID = 'exercise-media-fallback',
}) {
  const muscleKey = useMemo(() => getExerciseMuscleKey(exercise), [exercise]);
  const accent = MUSCLE_ACCENT[muscleKey] || MUSCLE_ACCENT.default;
  const iconName = MUSCLE_ICON[muscleKey] || MUSCLE_ICON.default;
  const name = formatExerciseName(exercise?.name);
  const equipment = String(exercise?.equipment || '').trim();
  const muscleLabel = formatMuscleLabel(muscleKey);
  const focusLabel = muscleLabel && muscleLabel !== 'Geral' ? `Foco: ${muscleLabel}` : '';

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        compact ? styles.wrapCompact : null,
        { backgroundColor: accent[0], borderColor: accent[1] },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: accent[1] }]}>
        <Ionicons name={iconName} size={compact ? 22 : 28} color={colors.textPrimary} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.name, compact ? styles.nameCompact : null]} numberOfLines={2}>
          {name}
        </Text>
        {focusLabel ? (
          <Text style={styles.focusLabel} numberOfLines={1}>
            {focusLabel}
          </Text>
        ) : null}
        {equipment ? (
          <Text style={styles.meta} numberOfLines={1}>
            {equipment.replace(/_/g, ' ')}
          </Text>
        ) : null}
        {showComingSoon ? (
          <>
            <Text style={styles.comingSoon}>{EXERCISE_DEMO_COMING_SOON}</Text>
            <Text style={styles.comingSoonHint}>{EXERCISE_DEMO_COMING_SOON_HINT}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  wrapCompact: {
    minHeight: 84,
    padding: spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  nameCompact: {
    fontSize: 14,
  },
  focusLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  comingSoon: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  comingSoonHint: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
