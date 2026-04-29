import React, { memo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const SetRow = memo(function SetRow({ set, index, onChange, onComplete, onSubmitWeight, onSubmitReps, simpleMode, testIDs }) {
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const [activeField, setActiveField] = useState(null);

  const values = {
    weight: String(set?.weight || ''),
    reps: String(set?.reps || ''),
    rpe: String(set?.rpe || ''),
  };

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

  const applyKey = (field, key) => {
    const current = String(values?.[field] || '');

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

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Text style={styles.index}>{index + 1}</Text>

        <TouchableOpacity
          testID={testIDs?.weight}
          onPress={() => setActiveField('weight')}
          style={[styles.input, activeField === 'weight' ? styles.inputActive : null]}
        >
          <Text style={styles.inputText}>{values.weight || 'Kg'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={testIDs?.reps}
          onPress={() => setActiveField('reps')}
          style={[styles.input, activeField === 'reps' ? styles.inputActive : null]}
        >
          <Text style={styles.inputText}>{values.reps || 'Reps'}</Text>
        </TouchableOpacity>

        {!simpleMode ? (
          <TouchableOpacity
            onPress={() => setActiveField('rpe')}
            style={[styles.input, activeField === 'rpe' ? styles.inputActive : null]}
          >
            <Text style={styles.inputText}>{values.rpe || 'RPE'}</Text>
          </TouchableOpacity>
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
