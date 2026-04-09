import React, { memo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const SetRow = memo(function SetRow({ set, index, onChange, onComplete, simpleMode, testIDs }) {
  return (
    <View style={styles.row}>
      <Text style={styles.index}>{index + 1}</Text>

      <TextInput
        testID={testIDs?.weight}
        value={String(set?.weight || '')}
        onChangeText={(text) => onChange('weight', text)}
        placeholder="Kg"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        style={styles.input}
      />

      <TextInput
        testID={testIDs?.reps}
        value={String(set?.reps || '')}
        onChangeText={(text) => onChange('reps', text)}
        placeholder="Reps"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        style={styles.input}
      />

      {!simpleMode ? (
        <TextInput
          value={String(set?.rpe || '')}
          onChangeText={(text) => onChange('rpe', text)}
          placeholder="RPE"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          style={styles.input}
        />
      ) : null}

      <TouchableOpacity
        testID={testIDs?.done}
        onPress={onComplete}
        style={[styles.button, set?.done ? styles.buttonDone : null]}
      >
        <Text style={styles.buttonText}>✔</Text>
      </TouchableOpacity>
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
