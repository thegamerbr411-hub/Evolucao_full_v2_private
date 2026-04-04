import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export function MetricText({ value, label }) {
  return (
    <View>
      <Text style={styles.metric}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    ...typography.metric,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
