import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, colors } from '../../theme';

export function ScreenHeader({ title, subtitle, onBack, rightAction, rightLabel }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.title, onBack && styles.titleWithBack]} numberOfLines={1}>{title}</Text>
        {rightAction ? (
          <TouchableOpacity onPress={rightAction} style={styles.rightBtn}>
            <Text style={styles.rightLabel}>{rightLabel || 'Ver tudo'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: spacing.xs,
    marginLeft: -4,
  },
  titleWithBack: {
    flex: 1,
  },
  title: {
    ...typography.title,
    flex: 1,
  },
  rightBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  rightLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  subtitle: {
    ...typography.body,
    marginTop: 6,
    color: colors.textSecondary,
  },
  divider: {
    marginTop: spacing.sm,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
});
