import React, { memo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import {
  buildWorkoutSetInputDisplay,
  formatDisplayText,
  normalizeSetFieldValue,
} from '../../services/workoutSetDisplayValue';

export const SetRow = memo(function SetRow({
  set,
  index,
  onChange,
  onComplete,
  onSubmitWeight,
  onSubmitReps,
  simpleMode,
  isCardio,
  rowState,
  isSaving = false,
  testIDs,
}) {
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const [activeField, setActiveField] = useState(null);

  const isSaved = Boolean(set?.done);
  const isDisabled = !isSaved && !(rowState?.canSave);

  const weightPlaceholder = isCardio ? 'Km' : 'Kg';
  const repsPlaceholder = isCardio ? 'Min' : 'Reps';

  const weightDisplay = buildWorkoutSetInputDisplay({
    rawValue: set?.weight,
    savedValue: isSaved ? set?.weight : '',
    placeholder: weightPlaceholder,
    isSaving,
    isSaved,
    isDisabled,
  });

  const repsDisplay = buildWorkoutSetInputDisplay({
    rawValue: set?.reps,
    savedValue: isSaved ? set?.reps : '',
    placeholder: repsPlaceholder,
    isSaving,
    isSaved,
    isDisabled,
  });

  const weightText = formatDisplayText({
    displayValue: weightDisplay.displayValue,
    placeholder: weightPlaceholder,
    showPlaceholder: weightDisplay.showPlaceholder,
  });

  const repsText = formatDisplayText({
    displayValue: repsDisplay.displayValue,
    placeholder: repsPlaceholder,
    showPlaceholder: repsDisplay.showPlaceholder,
  });

  const safeRowState = rowState || {
    status: 'pending',
    label: 'Pendente',
    actionLabel: '',
    canSave: false,
    showAction: false,
    accessibilityLabel: 'Pendente',
    helperText: '',
  };

  const handlePress = () => {
    if (!safeRowState.canSave) {
      return;
    }

    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    if (typeof onComplete === 'function') {
      onComplete();
    }
  };

  const applyKey = (field, key) => {
    if (typeof onChange !== 'function') {
      return;
    }

    const current = normalizeSetFieldValue(field === 'weight' ? set?.weight : field === 'reps' ? set?.reps : set?.rpe);

    if (key === 'backspace') {
      onChange(field, current.slice(0, -1));
      return;
    }

    if (key === 'clear') {
      onChange(field, '');
      return;
    }

    if (key === '.') {
      if (field === 'reps' || current.includes('.')) {
        return;
      }
      onChange(field, current ? `${current}.` : '0.');
      return;
    }

    const next = `${current}${key}`;
    onChange(field, next);
  };

  const confirmField = () => {
    if (activeField === 'weight' && typeof onSubmitWeight === 'function') {
      onSubmitWeight();
    }

    if (activeField === 'reps' && typeof onSubmitReps === 'function') {
      onSubmitReps();
    }

    setActiveField(null);
  };

  const statusStyle = safeRowState.status === 'saved'
    ? styles.statusSaved
    : safeRowState.status === 'ready'
      ? styles.statusReady
      : safeRowState.status === 'invalid'
        ? styles.statusInvalid
        : styles.statusPending;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Text style={styles.index}>{index + 1}</Text>

        <TouchableOpacity
          testID={testIDs?.weight}
          onPress={() => setActiveField('weight')}
          style={[styles.input, activeField === 'weight' ? styles.inputActive : null]}
        >
          <Text style={[styles.inputText, weightDisplay.showPlaceholder ? styles.inputPlaceholder : null]}>
            {weightText}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={testIDs?.reps}
          onPress={() => setActiveField('reps')}
          style={[styles.input, activeField === 'reps' ? styles.inputActive : null]}
        >
          <Text style={[styles.inputText, repsDisplay.showPlaceholder ? styles.inputPlaceholder : null]}>
            {repsText}
          </Text>
        </TouchableOpacity>

        {!simpleMode ? (
          <TouchableOpacity
            onPress={() => setActiveField('rpe')}
            style={[styles.input, activeField === 'rpe' ? styles.inputActive : null]}
          >
            <Text style={styles.inputText}>{normalizeSetFieldValue(set?.rpe) || 'RPE'}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={styles.statusText}>{safeRowState.label}</Text>
        </View>

        {safeRowState.showAction ? (
          <Animated.View
            style={[
              {
                transform: [{ scale: buttonScaleAnim }],
              },
            ]}
          >
            <TouchableOpacity
              testID={testIDs?.done}
              onPress={handlePress}
              disabled={!safeRowState.canSave}
              accessibilityRole="button"
              accessibilityLabel={safeRowState.accessibilityLabel}
              style={[
                styles.button,
                safeRowState.status === 'saved' ? styles.buttonSaved : null,
                safeRowState.status === 'ready' ? styles.buttonReady : null,
                !safeRowState.canSave ? styles.buttonDisabled : null,
              ]}
            >
              <Text style={styles.buttonText}>
                {safeRowState.status === 'saved'
                  ? '✔'
                  : safeRowState.actionLabel || safeRowState.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>

      {safeRowState.helperText ? (
        <Text style={styles.helperText}>{safeRowState.helperText}</Text>
      ) : null}

      {activeField ? (
        <View style={styles.keypadWrap}>
          <View style={styles.keypadGrid}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
              <TouchableOpacity
                key={`${activeField}-${key}`}
                style={styles.keypadKey}
                onPress={() => applyKey(activeField, key === '⌫' ? 'backspace' : key)}
              >
                <Text style={styles.keypadKeyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.keypadFooter}>
            <TouchableOpacity style={styles.keypadClear} onPress={() => applyKey(activeField, 'clear')}>
              <Text style={styles.keypadClearText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadOk} onPress={confirmField}>
              <Text style={styles.keypadOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  index: {
    width: 24,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  input: {
    width: 64,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  inputActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  inputText: {
    color: colors.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
  inputPlaceholder: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusPending: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusReady: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  statusSaved: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  statusInvalid: {
    borderColor: colors.warning,
    backgroundColor: colors.warningMuted,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  button: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
  },
  buttonReady: {
    backgroundColor: colors.success,
    borderColor: colors.success,
    minWidth: 88,
  },
  buttonSaved: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 11,
  },
  helperText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    marginTop: spacing.xxs,
    marginLeft: 28,
  },
  keypadWrap: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated || colors.card,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  keypadKey: {
    width: '23%',
    minHeight: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  keypadFooter: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  keypadClear: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadClearText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  keypadOk: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadOkText: {
    color: colors.textInverse,
    fontWeight: '800',
  },
});
