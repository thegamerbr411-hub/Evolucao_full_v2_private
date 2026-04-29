import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../ui';
import { colors, spacing, typography } from '../../theme';
import { getExerciseGifFallback } from '../../data/exerciseLibraryV2.js';
import { SetRow } from './SetRow';

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  lastSet,
  simpleMode,
  onChangeSet,
  onCompleteSet,
  onAddSet,
  onRemoveExercise,
  testIDs,
}) {
  const [hasGifError, setHasGifError] = React.useState(false);
  const gifUri = exercise?.gif || getExerciseGifFallback();

  const renderSetItem = React.useCallback(({ item: setItem, index }) => (
    <SetRow
      key={setItem.id || `${exercise.name}-${index}`}
      set={setItem}
      index={index}
      simpleMode={simpleMode}
      onChange={(field, value) => typeof onChangeSet === 'function' && onChangeSet(exercise.name, index, field, value)}
      onComplete={() => typeof onCompleteSet === 'function' && onCompleteSet(exercise.name, index)}
      testIDs={typeof testIDs === 'function' ? testIDs(setItem, index) : {}}
    />
  ), [exercise.name, onChangeSet, onCompleteSet, simpleMode, testIDs]);

  return (
    <AppCard>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{exercise.name}</Text>
        {onRemoveExercise ? (
          <TouchableOpacity onPress={() => onRemoveExercise(exercise.name)}>
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

      <FlatList
        data={Array.isArray(exercise.sets) ? exercise.sets : []}
        scrollEnabled={false}
        keyExtractor={(item, index) => String(item?.id || `${exercise.name}-${index}`)}
        renderItem={renderSetItem}
      />

      <TouchableOpacity testID={testIDs?.addSet || 'btn-add-set'} onPress={() => onAddSet(exercise.name)} style={styles.addButton}>
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
