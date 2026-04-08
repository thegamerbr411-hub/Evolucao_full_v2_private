import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AppCard } from '../ui';
import { colors, spacing, typography } from '../../theme';
import { SetRow } from './SetRow';

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  lastSet,
  simpleMode,
  onChangeSet,
  onCompleteSet,
  onAddSet,
  testIDs,
}) {
  return (
    <AppCard>
      <Text style={styles.title}>{exercise.name}</Text>
      {lastSet ? <Text style={styles.last}>Ultimo: {lastSet}</Text> : null}

      {exercise.sets.map((setItem, index) => (
        <SetRow
          key={setItem.id || `${exercise.name}-${index}`}
          set={setItem}
          index={index}
          simpleMode={simpleMode}
          onChange={(field, value) => onChangeSet(exercise.name, index, field, value)}
          onComplete={() => onCompleteSet(exercise.name, index)}
          testIDs={testIDs(index)}
        />
      ))}

      <TouchableOpacity onPress={() => onAddSet(exercise.name)} style={styles.addButton}>
        <Text style={styles.addText}>+ Adicionar serie</Text>
      </TouchableOpacity>
    </AppCard>
  );
});

const styles = StyleSheet.create({
  title: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  last: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  addButton: {
    marginTop: spacing.sm,
  },
  addText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
