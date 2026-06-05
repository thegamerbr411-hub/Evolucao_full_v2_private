import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { shouldShowExecutionVideoCta } from '../../utils/exerciseMedia';

export function ExerciseExecutionCta({
  onPress,
  media,
  style,
  testID = 'btn-ver-execucao',
}) {
  const promisesVideo = shouldShowExecutionVideoCta(media);
  const subtitle = promisesVideo
    ? 'Abrir guia com vídeo e instruções'
    : 'Ver passo a passo, dicas e erros comuns';

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <Ionicons name="play-circle-outline" size={20} color={colors.textPrimary} />
        <View style={styles.textWrap}>
          <Text style={styles.title}>Ver execução</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
