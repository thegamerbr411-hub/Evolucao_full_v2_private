import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../theme';
import { buildWorkoutSetInputDisplay, formatDisplayText } from '../../services/workoutSetDisplayValue';

export function WorkoutSetField({
  value,
  savedValue,
  placeholder,
  testID,
  onPress,
  focused,
  isSaving = false,
  isSaved = false,
  isDisabled = false,
  showPlaceholder: showPlaceholderOverride,
  displayValue: displayValueOverride,
}) {
  const display = buildWorkoutSetInputDisplay({
    rawValue: value,
    savedValue,
    placeholder,
    isSaving,
    isSaved,
    isDisabled,
  });

  const showPlaceholder = typeof showPlaceholderOverride === 'boolean'
    ? showPlaceholderOverride
    : display.showPlaceholder;
  const displayValue = displayValueOverride ?? display.displayValue;
  const visibleText = formatDisplayText({
    displayValue,
    placeholder: display.placeholder || placeholder,
    showPlaceholder,
  });

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.setField, focused ? styles.setFieldActive : null]}
      activeOpacity={0.85}
    >
      <Text style={[styles.setFieldText, showPlaceholder ? styles.setFieldPlaceholder : null]}>
        {visibleText}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  setField: {
    flex: 1,
    minWidth: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  setFieldActive: {
    borderColor: colors.primary,
    backgroundColor: '#0f2239',
  },
  setFieldText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  setFieldPlaceholder: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
