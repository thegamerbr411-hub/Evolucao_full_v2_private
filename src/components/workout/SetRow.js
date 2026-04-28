import React, { memo, useRef } from 'react';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const SetRow = memo(function SetRow({ set, index, onChange, onComplete, onSubmitWeight, onSubmitReps, simpleMode, testIDs }) {
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const weightInputRef = useRef(null);
  const repsInputRef = useRef(null);
  const rpeInputRef = useRef(null);

  const handlePress = () => {
    // Animação de escala: 1 → 0.92 → 1 (200ms total)
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

    // Chama callback original
    if (typeof onComplete === 'function') {
      onComplete();
    }
  };

  // BLOCO 2: Auto-submit na pressão de Enter
  const handleWeightSubmit = () => {
    if (typeof onSubmitWeight === 'function') {
      onSubmitWeight();
    }
    // Auto-focus próximo campo (reps)
    setTimeout(() => {
      if (repsInputRef.current?.focus) {
        repsInputRef.current.focus();
      }
    }, 50);
  };

  const handleRepsSubmit = () => {
    if (typeof onSubmitReps === 'function') {
      onSubmitReps();
    }
    // Se não é simpleMode, focus RPE; senão, submit direto
    if (!simpleMode) {
      setTimeout(() => {
        if (rpeInputRef.current?.focus) {
          rpeInputRef.current.focus();
        }
      }, 50);
    } else {
      // Em modo simples, Enter em reps = auto-complete
      handlePress();
    }
  };

  const handleRpeSubmit = () => {
    // Em modo avançado, Enter em RPE = auto-complete
    handlePress();
  };

  return (
    <View style={styles.row}>
      <Text style={styles.index}>{index + 1}</Text>

      <TextInput
        ref={weightInputRef}
        testID={testIDs?.weight}
        value={String(set?.weight || '')}
        onChangeText={(text) => onChange('weight', text)}
        placeholder="Kg"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        returnKeyType="next"
        onSubmitEditing={handleWeightSubmit}
        style={styles.input}
      />

      <TextInput
        ref={repsInputRef}
        testID={testIDs?.reps}
        value={String(set?.reps || '')}
        onChangeText={(text) => onChange('reps', text)}
        placeholder="Reps"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        returnKeyType={simpleMode ? 'done' : 'next'}
        onSubmitEditing={handleRepsSubmit}
        style={styles.input}
      />

      {!simpleMode ? (
        <TextInput
          ref={rpeInputRef}
          value={String(set?.rpe || '')}
          onChangeText={(text) => onChange('rpe', text)}
          placeholder="RPE"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={handleRpeSubmit}
          style={styles.input}
        />
      ) : null}

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
          style={[styles.button, set?.done ? styles.buttonDone : null]}
        >
          <Text style={styles.buttonText}>✔</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  index: {
    width: 24,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  input: {
    width: 64,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2435',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
});
