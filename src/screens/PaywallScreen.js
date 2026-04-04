import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { getAnalyticsMetrics, getConversionRates, trackEvent } from '../utils/analytics';

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
  const { getSubscriptionStatus, startProTrial, activateProPlan } = useApp();
  const status = useMemo(() => getSubscriptionStatus(), [getSubscriptionStatus]);

  const featureKey = route?.params?.featureKey || 'auto_coach';
  const source = route?.params?.source || 'app';
  const dynamicMessage = route?.params?.message || '';
  const copy = FEATURE_COPY[featureKey] || FEATURE_COPY.auto_coach;
  const metrics = getAnalyticsMetrics();
  const rates = getConversionRates();

  const canStartTrial = !status.isPro && status.source === 'free';

  useEffect(() => {
    trackEvent('paywall_open', { source, featureKey, hasTrial: canStartTrial });
  }, [source, featureKey, canStartTrial]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>EVOLUCAO PRO</Text>
      <Text style={styles.title}>Seu personal com IA</Text>
      <Text style={styles.subtitle}>Treine e evolua com inteligencia real.</Text>

      <View style={styles.highlightCard}>
        <Text style={styles.highlightTitle}>Voce tentou acessar:</Text>
        <Text style={styles.highlightFeature}>{copy.title}</Text>
        <Text style={styles.highlightSub}>{copy.subtitle}</Text>
        <Text style={styles.painText}>⚠️ {copy.pain}</Text>
        {dynamicMessage ? <Text style={styles.dynamicPainText}>⚠️ {dynamicMessage}</Text> : null}
        {__DEV__ ? <Text style={styles.sourceText}>Origem: {source}</Text> : null}
      </View>

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

      <View style={styles.bulletsCard}>
        <Text style={styles.bullet}>- Auto Coach completo com ajustes automaticos</Text>
        <Text style={styles.bullet}>- Analise semanal premium de macros e performance</Text>
        <Text style={styles.bullet}>- Scanner por foto real (modo avancado)</Text>
        <Text style={styles.bullet}>- Recursos de comunidade e ranking para manter consistencia</Text>
        <Text style={styles.bullet}>- 7 dias de garantia</Text>
        <Text style={styles.bullet}>- Cancele quando quiser</Text>
      </View>

      <View style={styles.proofCard}>
        <Text style={styles.proofText}>🔥 Mais de 1.000 treinos ja foram registrados no app.</Text>
        <Text style={styles.urgencyText}>⚠️ Oferta de preco atual pode sair a qualquer momento.</Text>
      </View>

      {__DEV__ ? (
        <View style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>Funil interno</Text>
          <Text style={styles.metricsLine}>paywall_open: {metrics.paywall_open || 0}</Text>
          <Text style={styles.metricsLine}>trial_start: {metrics.trial_start || 0}</Text>
          <Text style={styles.metricsLine}>pro_activated: {metrics.pro_activated || 0}</Text>
          <Text style={styles.metricsRates}>📊 Trial: {rates.trialRate}%</Text>
          <Text style={styles.metricsRates}>💎 PRO: {rates.proRate}%</Text>
        </View>
      ) : null}

      {canStartTrial ? (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            trackEvent('trial_start', { source, featureKey });
            startProTrial();
            navigation.goBack();
          }}
        >
          <Text style={styles.ctaButtonText}>Comecar gratis agora</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.trialButton}
        onPress={() => {
          trackEvent('pro_activated', { source, featureKey });
          activateProPlan();
          navigation.goBack();
        }}
      >
        <Text style={styles.trialButtonText}>Ja sou PRO</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          trackEvent('paywall_exit', { source, featureKey });
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
    backgroundColor: '#0A1224',
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 28,
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
  title: {
    marginTop: 12,
    fontSize: 31,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  subtitle: {
    marginTop: 8,
    color: '#A8B7D3',
    fontSize: 14,
    lineHeight: 21,
  },
  highlightCard: {
    marginTop: 16,
    backgroundColor: '#13294B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#365E95',
    padding: 14,
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
    marginTop: 12,
    backgroundColor: '#101D34',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B446D',
    padding: 12,
  },
  proofCard: {
    marginTop: 10,
    backgroundColor: '#1A2942',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A557E',
    padding: 12,
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
    marginTop: 10,
    backgroundColor: '#0E1A2F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B446D',
    padding: 12,
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
    marginTop: 14,
    backgroundColor: '#2A9E66',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  trialButton: {
    marginTop: 10,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  trialButtonText: {
    color: '#E9F1FF',
    fontWeight: '800',
    fontSize: 14,
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
