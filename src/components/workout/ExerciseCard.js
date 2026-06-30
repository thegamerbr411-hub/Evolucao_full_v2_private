import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { getExerciseByName } from '../../data/exercises.js';
import { ExerciseExecutionCta } from '../exercise/ExerciseExecutionCta';
import { ExerciseMediaFallback } from '../exercise/ExerciseMediaFallback';
import { resolveExerciseMedia } from '../../utils/exerciseMedia';
import { buildWorkoutSetRowState } from '../../services/workoutSetRowState.js';
import { resolvePreviousSetForRow } from '../../services/workoutPreviousSetCopy.js';
import { SetRow } from './SetRow';

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  lastSet,
  lastHistoricalSet,
  simpleMode,
  isSaving = false,
  onChangeSet,
  onCompleteSet,
  onAddSet,
  onRemoveExercise,
  onViewExecution,
  testIDs,
}) {
  const [thumbnailFailed, setThumbnailFailed] = React.useState(false);
  const safeExerciseName = String(exercise?.name || '').trim();
  const catalogExercise = useMemo(
    () => (safeExerciseName ? getExerciseByName(safeExerciseName) : null),
    [safeExerciseName]
  );
  const media = useMemo(
    () => resolveExerciseMedia({ ...catalogExercise, gif: exercise?.gif }),
    [catalogExercise, exercise?.gif]
  );
  const showRemoteThumbnail = media.hasRealThumbnail && !thumbnailFailed;
  const fallbackExercise = catalogExercise || { name: safeExerciseName };

  const safeSets = useMemo(
    () => (Array.isArray(exercise?.sets) ? exercise.sets.filter(Boolean) : []),
    [exercise?.sets]
  );

  const nextPendingSetIndex = useMemo(() => {
    const pendingIndex = safeSets.findIndex((setItem) => !setItem?.done);
    return pendingIndex >= 0 ? pendingIndex : safeSets.length;
  }, [safeSets]);

  const todaySetsForPrevious = useMemo(
    () => safeSets.map((setItem) => ({
      weight: setItem?.weight,
      reps: setItem?.reps,
      done: Boolean(setItem?.done),
    })),
    [safeSets]
  );

  const renderSetRow = React.useCallback((setItem, index) => {
    const resolvedSetIndex = Number.isInteger(setItem?.index) ? setItem.index : index;
    const canComplete = resolvedSetIndex === nextPendingSetIndex;

    const isFuture = resolvedSetIndex > nextPendingSetIndex;
    const isActiveSet = canComplete;
    const rowState = buildWorkoutSetRowState({
      weight: setItem?.weight,
      reps: setItem?.reps,
      rpe: setItem?.rpe,
      isSaved: Boolean(setItem?.done),
      isFuture,
      isActiveSet,
      isCardio: exercise?.category === 'cardio',
    });

    const previousLabel = resolvePreviousSetForRow({
      setIndex: resolvedSetIndex,
      todaySets: todaySetsForPrevious,
      lastHistoricalSet,
      isCardio: exercise?.category === 'cardio',
    });

    return (
      <SetRow
        key={setItem?.id || `${safeExerciseName}-${resolvedSetIndex}`}
        set={setItem}
        index={resolvedSetIndex}
        simpleMode={simpleMode}
        isCardio={exercise?.category === 'cardio'}
        rowState={rowState}
        isSaving={isSaving}
        previousLabel={previousLabel}
        onChange={(field, value) => {
          if (typeof onChangeSet !== 'function' || !safeExerciseName) {
            return;
          }
          onChangeSet(safeExerciseName, resolvedSetIndex, field, value);
        }}
        onComplete={() => {
          if (typeof onCompleteSet !== 'function' || !safeExerciseName || setItem?.done || !rowState.canSave) {
            return;
          }
          onCompleteSet(safeExerciseName, resolvedSetIndex);
        }}
        testIDs={typeof testIDs === 'function' ? testIDs(setItem, resolvedSetIndex) : {}}
      />
    );
  }, [exercise?.category, isSaving, lastHistoricalSet, nextPendingSetIndex, onChangeSet, onCompleteSet, safeExerciseName, simpleMode, testIDs, todaySetsForPrevious]);

  return (
    <AppCard>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{safeExerciseName || 'Exercício'}</Text>
        {onRemoveExercise ? (
          <TouchableOpacity onPress={() => typeof onRemoveExercise === 'function' && safeExerciseName && onRemoveExercise(safeExerciseName)}>
            <Text style={styles.removeExerciseText}>Remover</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!simpleMode ? (
        <>
          {showRemoteThumbnail ? (
            <Image
              source={{ uri: media.thumbnailUrl }}
              style={styles.gifPreview}
              resizeMode="cover"
              onError={() => setThumbnailFailed(true)}
            />
          ) : (
            <ExerciseMediaFallback exercise={fallbackExercise} compact testID="workout-exercise-media-fallback" />
          )}

          {typeof onViewExecution === 'function' && safeExerciseName ? (
            <ExerciseExecutionCta
              media={media}
              testID="btn-ver-execucao"
              onPress={() => onViewExecution(safeExerciseName)}
            />
          ) : null}

          {lastSet ? <Text style={styles.last}>Ultimo: {lastSet}</Text> : null}
        </>
      ) : null}

      <View>
        {safeSets.map((setItem, index) => renderSetRow(setItem, index))}
      </View>

      <TouchableOpacity testID={testIDs?.addSet || 'btn-add-set'} onPress={() => typeof onAddSet === 'function' && safeExerciseName && onAddSet(safeExerciseName)} style={styles.addButton}>
        <Text style={styles.addText}>+ Série</Text>
      </TouchableOpacity>
    </AppCard>
  );
});

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  removeExerciseText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  gifPreview: {
    width: '100%',
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
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
