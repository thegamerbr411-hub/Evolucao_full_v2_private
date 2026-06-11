// src/features/betaFeedback/AdminBetaFeedbackScreen.js

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

export default function AdminBetaFeedbackScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Painel Admin Feedback</Text>
      <Text style={styles.subtitle}>
        Triagem de feedbacks beta
      </Text>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Nenhum dado real conectado ainda
        </Text>
        <Text style={styles.placeholderSubtext}>
          Acesso admin será habilitado por permissões em fase futura
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Funcionalidades planejadas:</Text>
        <Text style={styles.infoItem}>• Listar todos feedbacks beta</Text>
        <Text style={styles.infoItem}>• Filtrar por tipo/severidade/status</Text>
        <Text style={styles.infoItem}>• Visualizar anexos</Text>
        <Text style={styles.infoItem}>• Mudar status (triage/resolvido/etc)</Text>
        <Text style={styles.infoItem}>• Adicionar notas internas</Text>
        <Text style={styles.infoItem}>• Métricas agregadas</Text>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>Segurança:</Text>
        <Text style={styles.warningItem}>
          • Acesso restrito a usuários admin
        </Text>
        <Text style={styles.warningItem}>
          • Allowlist segura por email/adminIds
        </Text>
        <Text style={styles.warningItem}>
          • Custom claims do Firebase Auth depois
        </Text>
        <Text style={styles.warningItem}>
          • Não exposto para usuários beta
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  placeholder: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  placeholderSubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  infoBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  infoItem: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  warningBox: {
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  warningItem: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
});
