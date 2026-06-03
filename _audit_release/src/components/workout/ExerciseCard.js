import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../ui';
import { colors, spacing, typography } from '../../theme';
import { getExerciseGifFallback } from '../../data/exerciseLibraryV2.js';
import { buildWorkoutSetRowState } from '../../services/workoutSetRowState.js';
import { SetRow } from './SetRow';

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  lastSet,
  simpleMode,
  isSaving = false,
  onChangeSet,
  onCompleteSet,
  onAddSet,
  onRemoveExercise,
  testIDs,
}) {
  const [hasGifError, setHasGifError] = React.useState(false);
  const gifUri = exercise?.gif || getExerciseGifFallback();
  const safeExerciseName = String(exercise?.name || '').trim();
  const safeSets = React.useMemo(
    () => (Array.isArray(exercise?.sets) ? exercise.sets.filter(Boolean) : []),
    [exercise?.sets]
  );

  const nextPendingSetIndex = React.useMemo(() => {
    const pendingIndex = safeSets.findIndex((setItem) => !setItem?.done);
    return pendingIndex >= 0 ? pendingIndex : safeSets.length;
  }, [safeSets]);

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

    return (
      <SetRow
        key={setItem?.id || `${safeExerciseName}-${resolvedSetIndex}`}
        set={setItem}
        index={resolvedSetIndex}
        simpleMode={simpleMode}
        isCardio={exercise?.category === 'cardio'}
        rowState={rowState}
        isSaving={isSaving}
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
  }, [exercise?.category, isSaving, nextPendingSetIndex, onChangeSet, onCompleteSet, safeExerciseName, simpleMode, testIDs]);

  return (
    <AppCard>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{safeExerciseName || 'Exercicio'}</Text>
        {onRemoveExercise ? (
          <TouchableOpacity onPress={() => typeof onRemoveExercise === 'function' && safeExerciseName && onRemoveExercise(safeExerciseName)}>
            <Text style={styles.removeExerciseText}>Remover</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!simpleMode ? (
        <>
          {!hasGifError ? (
            <Image source={{ uri: gifUri }} style={styles.gifPreview} resizeMode="cover" onError={() => setHasGifError(true)} />
          ) : (
            <View style={styles.gifFallback}><Text style={styles.gifFallbackText}>Preview indisponivel</Text></View>
          )}

          {lastSet ? <Text style={styles.last}>Ultimo: {lastSet}</Text> : null}
        </>
      ) : null}

      {/*
        P0: evitar FlatList virtualizada dentro de FlatList+ScrollView (WorkoutScreen).
        Com scrollEnabled=false o ganho de virtualizacao e zero; no Android costuma
        truncar linhas / altura errada. Map mantem mesma UX com lista pequena (series).
      */}
      <View>
        {safeSets.map((setItem, index) => renderSetRow(setItem, index))}
      </View>

      <TouchableOpacity testID={testIDs?.addSet || 'btn-add-set'} onPress={() => typeof onAddSet === 'function' && safeExerciseName && onAddSet(safeExerciseName)} style={styles.addButton}>
        <Text style={styles.addText}>+ Serie</Text>
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
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
  },
  gifPreview: {
    width: '100%',
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  gifFallback: {
    width: '100%',
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  gifFallbackText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
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
