import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNotifications, useNutrition } from '../hooks';
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
  const { getWeeklyMacroSummary, getNutritionFeedback } = useNutrition();
  const { hasFeatureAccess } = useNotifications();
  const hasAccess = hasFeatureAccess('weekly_macros');

  const summary = useMemo(() => getWeeklyMacroSummary(), [getWeeklyMacroSummary]);
  const hasData = Array.isArray(summary.days) && summary.days.length > 0;
  const weeklyFeedback = useMemo(
    () => getNutritionFeedback({
      proteinConsumed: Number(summary.avgProtein || 0),
      caloriesConsumed: Number(summary.avgCalories || 0),
      trainedToday: Number(summary.trainedDays || 0) > 0,
    }),
    [getNutritionFeedback, summary.avgProtein, summary.avgCalories, summary.trainedDays]
  );

  const last4Days = useMemo(() => (summary.days || []).slice(0, 4), [summary.days]);
  const proteinRisk = useMemo(() => {
    const lowInLast4 = last4Days.filter((item) => item.proteinStatus === 'baixo').length;
    return {
      lowInLast4,
      isHigh: lowInLast4 >= 3,
      message: lowInLast4 >= 3
        ? 'Risco de perda de massa magra identificado.'
        : 'Sem risco alto de proteina na semana atual.',
    };
  }, [last4Days]);

  const trainingProteinCorrelation = useMemo(() => {
    const trained = (summary.days || []).filter((item) => item.trained);
    const trainedProteinOk = trained.filter((item) => item.proteinStatus !== 'baixo').length;
    return {
      trainedDays: trained.length,
      trainedProteinOk,
      trainedProteinLow: Math.max(0, trained.length - trainedProteinOk),
    };
  }, [summary.days]);

  const weeklyActions = useMemo(() => {
    const actions = [];
    if (proteinRisk.isHigh) {
      actions.push('Adicionar +20g de proteina no cafe da manha dos proximos 3 dias.');
    }
    if (summary.highFatDays >= 3) {
      actions.push('Reduzir ~300 kcal no jantar de domingo (corte de gorduras ocultas).');
    }
    if (!actions.length && summary.lowCarbDays >= 3 && summary.trainedDays >= 2) {
      actions.push('Adicionar +30g de carbo no pre-treino para sustentar performance.');
    }
    if (actions.length < 2) {
      actions.push('Fechar o dia com uma fonte limpa de proteina (iogurte, frango ou whey).');
    }
    return actions.slice(0, 2);
  }, [proteinRisk.isHigh, summary.highFatDays, summary.lowCarbDays, summary.trainedDays]);

  if (!hasAccess) {
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
            <Text style={styles.section}>Risco da semana</Text>
            <Text style={[styles.lineStrong, proteinRisk.isHigh ? styles.riskHigh : styles.riskOk]}>
              {proteinRisk.isHigh ? '⚠️ Alto' : '✅ Controlado'}
            </Text>
            <Text style={styles.line}>{proteinRisk.message}</Text>
            <Text style={styles.line}>Feedback do coach: {weeklyFeedback?.title || '-'}</Text>
            <Text style={styles.line}>Sugestao: {weeklyFeedback?.suggestion || '-'}</Text>
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

          <AppCard>
            <Text style={styles.section}>Correlacao treino x proteina</Text>
            <Text style={styles.line}>Treinos na semana: {trainingProteinCorrelation.trainedDays}</Text>
            <Text style={styles.line}>Treinos com proteina adequada: {trainingProteinCorrelation.trainedProteinOk}</Text>
            <Text style={styles.line}>Treinos com proteina baixa: {trainingProteinCorrelation.trainedProteinLow}</Text>
          </AppCard>

          <AppCard>
            <Text style={styles.section}>Plano de 2 acoes</Text>
            <Text style={styles.line}>1. {weeklyActions[0]}</Text>
            <Text style={styles.line}>2. {weeklyActions[1]}</Text>
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
  lineStrong: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  riskHigh: {
    color: '#FCD34D',
  },
  riskOk: {
    color: '#86EFAC',
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
