import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

const STATUS_COLOR = {
  ok: colors.success,
  baixo: colors.danger,
  alto: colors.warning,
};

function classifyColor(status) {
  return STATUS_COLOR[status] || colors.textSecondary;
}

function MacroPill({ label, status }) {
  const color = classifyColor(status);
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function DayRow({ item, isLast }) {
  return (
    <View style={[styles.dayRow, isLast ? styles.dayRowLast : null]}>
      <Text style={styles.dayDate}>{item.date ? item.date.slice(5) : '--'}</Text>
      <View style={styles.dayPills}>
        <MacroPill label={`P ${item.protein}g`} status={item.proteinStatus} />
        <MacroPill label={`C ${item.carbs}g`} status={item.carbStatus} />
        <MacroPill label={`G ${item.fats}g`} status={item.fatStatus} />
      </View>
      <Text style={styles.dayKcal}>{item.calories} kcal</Text>
    </View>
  );
}

export default function WeeklyMacroScreen({ navigation }) {
  const { getWeeklyMacroSummary, hasFeatureAccess } = useApp();

  if (!hasFeatureAccess('weekly_macros')) {
    return (
      <View style={styles.lockContainer}>
        <ScreenHeader title="Macros da Semana" subtitle="Esse recurso faz parte do Evolucao PRO." />
        <PrimaryButton
          title="Desbloquear PRO"
          onPress={() => navigation.replace('Paywall', { featureKey: 'weekly_macros', source: 'weekly_macro_screen' })}
        />
      </View>
    );
  }

  const summary = useMemo(() => getWeeklyMacroSummary(), [getWeeklyMacroSummary]);
  const hasData = Array.isArray(summary.days) && summary.days.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Macros da Semana" subtitle="Resumo nutricional e consistencia semanal." />

      {!hasData ? (
        <AppCard>
          <Text style={styles.emptyText}>Nenhum dia registrado ainda. Analise seu dia para ver o resumo semanal aqui.</Text>
        </AppCard>
      ) : (
        <>
          <AppCard>
            <Text style={styles.section}>Resumo rapido</Text>
            <Text style={styles.line}>Dias analisados: {summary.analyzedDays}</Text>
            <Text style={styles.line}>Treinos: {summary.trainedDays}</Text>
            <Text style={styles.line}>Dias com proteina baixa: {summary.lowProteinDays}</Text>
          </AppCard>

          <AppCard>
            <Text style={styles.section}>Medias da semana</Text>
            <Text style={styles.line}>Calorias: {summary.avgCalories} kcal (meta {Math.round(summary.macroTargets?.calories || 0)} kcal)</Text>
            <Text style={styles.line}>Proteina: {summary.avgProtein}g (meta {Math.round(summary.macroTargets?.protein || 0)}g)</Text>
            <Text style={styles.line}>Carbo: {summary.avgCarbs}g (meta {Math.round(summary.macroTargets?.carbs || 0)}g)</Text>
            <Text style={styles.line}>Gordura: {summary.avgFats}g (meta {Math.round(summary.macroTargets?.fats || 0)}g)</Text>
          </AppCard>

          <AppCard>
            <Text style={styles.section}>Registro por dia</Text>
            {summary.days.map((item, index) => (
              <DayRow key={item.date} item={item} isLast={index === summary.days.length - 1} />
            ))}
          </AppCard>

          <AppCard>
            <Text style={styles.section}>Insight IA</Text>
            <Text style={styles.line}>{summary.insight}</Text>
          </AppCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
  },
  section: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  line: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  dayRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  dayRowLast: {
    borderBottomWidth: 0,
  },
  dayDate: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayPills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  dayKcal: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
