import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { trackEvent } from '../utils/analytics';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

function statusColor(status) {
  if (status === 'ok') {
    return '#2A9E66';
  }

  if (status === 'alto') {
    return '#C57D00';
  }

  return '#C14343';
}

function MacroBar({ label, consumed, target, status }) {
  const ratio = target ? Math.max(0, Math.min(1, consumed / target)) : 0;

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{consumed}g / {target}g</Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: statusColor(status) }]} />
      </View>
      <Text style={[styles.macroStatus, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function humanMacroFeedback(macroInsight) {
  if (!macroInsight?.status) {
    return '';
  }

  const parts = [];
  if (macroInsight.status.protein === 'baixo') {
    parts.push('⚠️ Proteina baixa: isso pode prejudicar sua recuperacao muscular.');
  }
  if (macroInsight.status.carbs === 'baixo') {
    parts.push('⚠️ Carbo baixo: sua energia para treinar pode cair.');
  }
  if (macroInsight.status.fats === 'alto') {
    parts.push('⚠️ Gordura alta: pode estar estourando suas calorias do dia.');
  }

  if (!parts.length) {
    parts.push('✅ Macros equilibrados hoje. Continue nessa consistencia.');
  }

  return parts.join('\n');
}

export default function DayAnalysisScreen({ navigation, route }) {
  const { plan, analyzeDay, getDailyMacroTargets, getSubscriptionStatus } = useApp();
  const params = route?.params || {};
  const postValuePaywall = params.postValuePaywall || null;
  const paywallExperiment = params.paywallExperiment || null;
  const [consumedCalories, setConsumedCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [trainedToday, setTrainedToday] = useState(false);
  const [insight, setInsight] = useState(null);

  const targetCalories = useMemo(() => plan?.caloriesPerDay ?? 0, [plan]);
  const macroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);
  const subscriptionStatus = useMemo(() => getSubscriptionStatus(), [getSubscriptionStatus]);
  const shouldShowPostValueUpsell = Boolean(insight && postValuePaywall && !subscriptionStatus?.isPro);

  React.useEffect(() => {
    if (params.prefillCalories) {
      setConsumedCalories(String(params.prefillCalories));
    }
    if (params.prefillProtein) {
      setProtein(String(params.prefillProtein));
    }
    if (params.prefillCarbs) {
      setCarbs(String(params.prefillCarbs));
    }
    if (params.prefillFats) {
      setFats(String(params.prefillFats));
    }
  }, [params.prefillCalories, params.prefillProtein, params.prefillCarbs, params.prefillFats]);

  const handleAnalyze = () => {
    const result = analyzeDay({
      consumedCalories: Number(consumedCalories),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats),
      trained: trainedToday,
      trainedToday,
    });
    setInsight(result);
  };

  const handleOpenPostValuePaywall = () => {
    if (!postValuePaywall) {
      return;
    }

    trackEvent('paywall_timing_value_moment_clicked', {
      source: 'day_analysis',
      featureKey: postValuePaywall.featureKey,
      timingExperimentKey: paywallExperiment?.key || postValuePaywall?.paywallExperiment?.key || '',
      timingVariant: paywallExperiment?.variant || postValuePaywall?.paywallExperiment?.variant || '',
    });

    navigation.navigate('Paywall', {
      ...postValuePaywall,
      paywallExperiment: paywallExperiment || postValuePaywall?.paywallExperiment,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="IA Analisando Seu Dia" subtitle="Receba uma recomendacao rapida com base no seu plano." />

      <AppCard>
        <Text style={styles.cardTitle}>Meta de calorias</Text>
        <Text style={styles.bigNumber}>{targetCalories ? `${targetCalories} kcal` : '-'}</Text>
      </AppCard>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Calorias consumidas hoje</Text>
        <TextInput
          keyboardType="numeric"
          value={consumedCalories}
          onChangeText={setConsumedCalories}
          placeholder="Ex: 1850"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Proteina consumida (g)</Text>
        <TextInput
          keyboardType="numeric"
          value={protein}
          onChangeText={setProtein}
          placeholder="Ex: 130"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Carboidrato consumido (g)</Text>
        <TextInput
          keyboardType="numeric"
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Ex: 220"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Gordura consumida (g)</Text>
        <TextInput
          keyboardType="numeric"
          value={fats}
          onChangeText={setFats}
          placeholder="Ex: 65"
          style={styles.input}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Treinou hoje?</Text>
        <Switch value={trainedToday} onValueChange={setTrainedToday} />
      </View>

      <PrimaryButton title="Analisar meu dia" onPress={handleAnalyze} />

      {insight ? (
        <AppCard style={styles.resultCard}>
          <Text style={styles.resultTitle}>Diagnostico IA</Text>
          <Text style={styles.resultMessage}>{insight.message}</Text>
          <Text style={styles.resultSubTitle}>Analise de macros</Text>
          <MacroBar
            label="Proteina"
            consumed={Number(protein || 0)}
            target={insight?.macroTargets?.protein || macroTargets.protein}
            status={insight?.macroInsight?.status?.protein || 'baixo'}
          />
          <MacroBar
            label="Carbo"
            consumed={Number(carbs || 0)}
            target={insight?.macroTargets?.carbs || macroTargets.carbs}
            status={insight?.macroInsight?.status?.carbs || 'baixo'}
          />
          <MacroBar
            label="Gordura"
            consumed={Number(fats || 0)}
            target={insight?.macroTargets?.fats || macroTargets.fats}
            status={insight?.macroInsight?.status?.fats || 'baixo'}
          />
          <Text style={styles.macroFeedback}>{insight?.macroInsight?.message}</Text>
          <Text style={styles.macroCoachFeedback}>{humanMacroFeedback(insight?.macroInsight)}</Text>
          <Text style={styles.autoSaved}>Análise salva automaticamente no histórico.</Text>
          {shouldShowPostValueUpsell ? (
            <View style={styles.upsellWrap}>
              <Text style={styles.upsellText}>Quer acelerar esse resultado? Desbloqueie ajuste completo com PRO.</Text>
              <PrimaryButton testID="btn-day-analysis-postvalue-paywall" title="Desbloquear meu plano" onPress={handleOpenPostValuePaywall} />
            </View>
          ) : null}
        </AppCard>
      ) : null}
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
  cardTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  bigNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#141922',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  row: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCard: {
    marginTop: spacing.md,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  resultMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  autoSaved: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  resultSubTitle: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  macroRow: {
    marginTop: 8,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  macroLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  macroValue: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  macroTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  macroFill: {
    height: 8,
  },
  macroStatus: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '800',
  },
  macroFeedback: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  macroCoachFeedback: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  upsellWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  upsellText: {
    color: '#FFD9BE',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
});
