import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { getAnalyticsMetrics, getConversionRates, trackEvent } from '../utils/analytics';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

const PAYWALL_COPY_EXPERIMENT_KEY = 'exp_paywall_copy_v1';

function resolveExperimentVariant(seed = '') {
  const source = String(seed || 'anonymous');
  let acc = 0;
  for (let i = 0; i < source.length; i += 1) {
    acc = (acc + source.charCodeAt(i) * (i + 1)) % 9973;
  }
  return acc % 2 === 0 ? 'A' : 'B';
}

const FEATURE_COPY = {
  auto_coach: {
    title: 'Auto Coach avancado',
    subtitle: 'Ajustes inteligentes de treino e macro com base na sua semana.',
    pain: 'Voce pode estar evoluindo mais lento sem ajuste automatico de treino e dieta.',
  },
  weekly_macros: {
    title: 'Analise semanal completa',
    subtitle: 'Veja diagnostico de macros com insights mais profundos.',
    pain: 'Sem essa analise, voce nao enxerga onde realmente esta errando na semana.',
  },
  photo_scanner: {
    title: 'Scanner por foto real',
    subtitle: 'Estimativa nutricional avancada por descricao/foto do prato.',
    pain: 'Sem scanner avancado, voce pode subestimar calorias e macros das refeicoes.',
  },
};

export default function PaywallScreen({ navigation, route }) {
  const { getSubscriptionStatus, startProTrial, activateProPlan, user } = useApp();
  const status = useMemo(() => getSubscriptionStatus(), [getSubscriptionStatus]);

  const featureKey = route?.params?.featureKey || 'auto_coach';
  const source = route?.params?.source || 'app';
  const dynamicMessage = route?.params?.message || '';
  const timingExperimentKey = route?.params?.paywallExperiment?.key || '';
  const timingVariant = route?.params?.paywallExperiment?.variant || '';
  const copyVariant = useMemo(
    () => resolveExperimentVariant(`${PAYWALL_COPY_EXPERIMENT_KEY}:${String(user?.id || 'anonymous')}`),
    [user?.id]
  );
  const baseCopy = FEATURE_COPY[featureKey] || FEATURE_COPY.auto_coach;
  const copy = copyVariant === 'B'
    ? {
      ...baseCopy,
      title: `Seu resultado da semana pode acelerar` ,
      subtitle: 'Receba ajuste semanal guiado por dados para ganhar consistencia e evoluir com menos tentativa e erro.',
      pain: 'Sem plano orientado por resultado, sua evolucao pode ficar lenta mesmo treinando forte.',
    }
    : baseCopy;
  const metrics = getAnalyticsMetrics();
  const rates = getConversionRates();

  const canStartTrial = !status.isPro && status.source === 'free';

  useEffect(() => {
    trackEvent('paywall_open', {
      source,
      featureKey,
      hasTrial: canStartTrial,
      copyExperimentKey: PAYWALL_COPY_EXPERIMENT_KEY,
      copyVariant,
      timingExperimentKey,
      timingVariant,
    });
  }, [source, featureKey, canStartTrial, copyVariant, timingExperimentKey, timingVariant]);

  return (
    <ScrollView testID="screen-paywall" contentContainerStyle={styles.container}>
      <Text style={styles.badge}>EVOLUCAO PRO</Text>
      <ScreenHeader title="Seu personal com IA" subtitle="Treine e evolua com inteligencia real." />

      <AppCard style={styles.highlightCard}>
        <Text style={styles.highlightTitle}>Voce tentou acessar:</Text>
        <Text style={styles.highlightFeature}>{copy.title}</Text>
        <Text style={styles.highlightSub}>{copy.subtitle}</Text>
        <Text style={styles.painText}>⚠️ {copy.pain}</Text>
        {dynamicMessage ? <Text style={styles.dynamicPainText}>⚠️ {dynamicMessage}</Text> : null}
        {__DEV__ ? <Text style={styles.sourceText}>Origem: {source}</Text> : null}
      </AppCard>

      <View style={styles.planCardPrimary}>
        <Text style={styles.planTag}>RECOMENDADO</Text>
        <Text style={styles.planTitle}>Plano Anual</Text>
        <Text style={styles.planPrice}>R$ 99/ano</Text>
        <Text style={styles.planHint}>Equivale a R$ 8,25 por mes</Text>
      </View>

      <View style={styles.planCardSecondary}>
        <Text style={styles.planTitleSecondary}>Plano Mensal</Text>
        <Text style={styles.planPriceSecondary}>R$ 19,90/mes</Text>
      </View>

      <AppCard style={styles.bulletsCard}>
        <Text style={styles.bullet}>- Auto Coach completo com ajustes automaticos</Text>
        <Text style={styles.bullet}>- Analise semanal premium de macros e performance</Text>
        <Text style={styles.bullet}>- Scanner por foto real (modo avancado)</Text>
        <Text style={styles.bullet}>- Recursos de comunidade e ranking para manter consistencia</Text>
        <Text style={styles.bullet}>- 7 dias de garantia</Text>
        <Text style={styles.bullet}>- Cancele quando quiser</Text>
      </AppCard>

      <AppCard style={styles.proofCard}>
        <Text style={styles.proofText}>🔥 Mais de 1.000 treinos ja foram registrados no app.</Text>
        <Text style={styles.urgencyText}>⚠️ Oferta de preco atual pode sair a qualquer momento.</Text>
      </AppCard>

      {__DEV__ ? (
        <AppCard style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>Funil interno</Text>
          <Text style={styles.metricsLine}>paywall_open: {metrics.paywall_open || 0}</Text>
          <Text style={styles.metricsLine}>trial_start: {metrics.trial_start || 0}</Text>
          <Text style={styles.metricsLine}>pro_activated: {metrics.pro_activated || 0}</Text>
          <Text style={styles.metricsRates}>📊 Trial: {rates.trialRate}%</Text>
          <Text style={styles.metricsRates}>💎 PRO: {rates.proRate}%</Text>
        </AppCard>
      ) : null}

      {canStartTrial ? (
        <PrimaryButton
          testID="btn-paywall-trial"
          title="Comecar gratis agora"
          style={styles.ctaButton}
          onPress={async () => {
            trackEvent('paywall_clicked', {
              source,
              featureKey,
              cta: 'trial_start',
              copyExperimentKey: PAYWALL_COPY_EXPERIMENT_KEY,
              copyVariant,
              timingExperimentKey,
              timingVariant,
            });
            trackEvent('trial_start', {
              source,
              featureKey,
              copyExperimentKey: PAYWALL_COPY_EXPERIMENT_KEY,
              copyVariant,
              timingExperimentKey,
              timingVariant,
            });
            const result = await startProTrial();
            if (result?.ok !== false) {
              navigation.goBack();
            }
          }}
        />
      ) : null}

      <SecondaryButton
        testID="btn-paywall-pro"
        title="Ja sou PRO"
        style={styles.trialButton}
        onPress={async () => {
          trackEvent('paywall_clicked', {
            source,
            featureKey,
            cta: 'pro_activated',
            copyExperimentKey: PAYWALL_COPY_EXPERIMENT_KEY,
            copyVariant,
            timingExperimentKey,
            timingVariant,
          });
          trackEvent('pro_activated', {
            source,
            featureKey,
            copyExperimentKey: PAYWALL_COPY_EXPERIMENT_KEY,
            copyVariant,
            timingExperimentKey,
            timingVariant,
          });
          const result = await activateProPlan();
          if (result?.ok !== false) {
            navigation.goBack();
          }
        }}
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          trackEvent('paywall_exit', {
            source,
            featureKey,
            copyExperimentKey: PAYWALL_COPY_EXPERIMENT_KEY,
            copyVariant,
            timingExperimentKey,
            timingVariant,
          });
          navigation.goBack();
        }}
      >
        <Text style={styles.backButtonText}>Continuar no plano gratis</Text>
      </TouchableOpacity>
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
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F97316',
    color: '#FFFFFF',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  highlightCard: {
    marginTop: spacing.md,
  },
  highlightTitle: {
    color: '#A8C9F7',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  highlightFeature: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  highlightSub: {
    marginTop: 4,
    color: '#D5E7FF',
    fontSize: 13,
    lineHeight: 19,
  },
  painText: {
    marginTop: 8,
    color: '#FFE4D6',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  dynamicPainText: {
    marginTop: 8,
    color: '#FFD8A8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  sourceText: {
    marginTop: 8,
    color: '#8FB1DD',
    fontSize: 11,
  },
  planCardPrimary: {
    marginTop: 14,
    backgroundColor: '#F97316',
    borderRadius: 14,
    padding: 14,
  },
  planTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF33',
    color: '#FFFFFF',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 3,
  },
  planHint: {
    marginTop: 2,
    color: '#FFE8D4',
    fontSize: 12,
    fontWeight: '700',
  },
  planCardSecondary: {
    marginTop: 10,
    backgroundColor: '#1A2740',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334D76',
    padding: 14,
  },
  planTitleSecondary: {
    color: '#D5E7FF',
    fontSize: 14,
    fontWeight: '700',
  },
  planPriceSecondary: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 3,
  },
  bulletsCard: {
    marginTop: spacing.md,
  },
  proofCard: {
    marginTop: spacing.sm,
  },
  proofText: {
    color: '#E5EDFF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  urgencyText: {
    marginTop: 6,
    color: '#FFD9BE',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  metricsCard: {
    marginTop: spacing.sm,
  },
  metricsTitle: {
    color: '#BFD4F7',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricsLine: {
    color: '#D9E7FF',
    fontSize: 12,
    marginBottom: 3,
    fontWeight: '700',
  },
  metricsRates: {
    color: '#FFE0B2',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '800',
  },
  bullet: {
    color: '#D5E7FF',
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 19,
  },
  ctaButton: {
    marginTop: spacing.md,
  },
  trialButton: {
    marginTop: spacing.sm,
  },
  backButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#97A9CA',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
