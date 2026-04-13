// src/features/onboarding/OnboardingScreen.tsx
/**
 * Tela de onboarding
 * - 4 passos que convertem
 * - Animações suaves
 * - Call-to-action clara
 */

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
} from 'react-native-reanimated'
import { useOnboardingStore, getGoalMessage } from './onboardingStore'
import { PrimaryButton } from '../../components/PrimaryButton'

const { width, height } = Dimensions.get('window')

export const OnboardingScreen = () => {
  const { currentStep, userData, setGoal, setLevel, setFrequency, completeOnboarding } =
    useOnboardingStore()

  if (currentStep === 'welcome') {
    return (
      <Animated.View style={styles.container} entering={FadeIn}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>💪</Text>
          <Text style={styles.title}>Bem-vindo ao EVOLUÇÃO</Text>
          <Text style={styles.subtitle}>Seu coach pessoal de musculação</Text>
        </View>

        <View style={styles.benefits}>
          <BenefitRow icon="📊" text="Progressão Automática" />
          <BenefitRow icon="🧠" text="Coach IA Inteligente" />
          <BenefitRow icon="👥" text="Compita com Amigos" />
          <BenefitRow icon="🏆" text="Desafios Gamificados" />
        </View>

        <PrimaryButton
          title="Vamo Começar 🚀"
          onPress={() => useOnboardingStore.getState().setStep('goal')}
          variant="success"
          style={styles.cta}
        />

        <Pressable onPress={completeOnboarding}>
          <Text style={styles.skipText}>Pular onboarding</Text>
        </Pressable>
      </Animated.View>
    )
  }

  if (currentStep === 'goal') {
    return (
      <Animated.View style={styles.container} entering={SlideInRight}>
        <Text style={styles.stepTitle}>Qual é seu objetivo?</Text>

        <View style={styles.optionsContainer}>
          <OptionButton
            icon="💪"
            title="Força"
            subtitle="Pesar mais"
            onPress={() => setGoal('strength')}
          />
          <OptionButton
            icon="📈"
            title="Hipertrofia"
            subtitle="Ficar grande"
            onPress={() => setGoal('hypertrophy')}
          />
          <OptionButton
            icon="⏱️"
            title="Resistência"
            subtitle="Durar mais"
            onPress={() => setGoal('endurance')}
          />
          <OptionButton
            icon="🔥"
            title="Perder Gordura"
            subtitle="Ficar definido"
            onPress={() => setGoal('fat_loss')}
          />
        </View>
      </Animated.View>
    )
  }

  if (currentStep === 'level') {
    return (
      <Animated.View style={styles.container} entering={SlideInRight}>
        <Text style={styles.stepTitle}>
          {getGoalMessage(userData.goal)}
        </Text>

        <Text style={styles.subtitle}>Qual seu nível de experiência?</Text>

        <View style={styles.optionsContainer}>
          <OptionButton
            icon="🌱"
            title="Iniciante"
            subtitle="Nunca treinei"
            onPress={() => setLevel('beginner')}
          />
          <OptionButton
            icon="📚"
            title="Intermediário"
            subtitle="Treino há alguns meses"
            onPress={() => setLevel('intermediate')}
          />
          <OptionButton
            icon="🦾"
            title="Avançado"
            subtitle="Veterano"
            onPress={() => setLevel('advanced')}
          />
        </View>
      </Animated.View>
    )
  }

  if (currentStep === 'frequency') {
    return (
      <Animated.View style={styles.container} entering={SlideInRight}>
        <Text style={styles.stepTitle}>Com que frequência você quer treinar?</Text>

        <View style={styles.optionsContainer}>
          <OptionButton
            icon="🏃"
            title="Leve"
            subtitle="2-3x por semana"
            onPress={() => setFrequency('light')}
          />
          <OptionButton
            icon="🚴"
            title="Moderada"
            subtitle="3-4x por semana"
            onPress={() => setFrequency('moderate')}
          />
          <OptionButton
            icon="⚡"
            title="Intensa"
            subtitle="5-6x por semana"
            onPress={() => setFrequency('intense')}
          />
        </View>
      </Animated.View>
    )
  }

  // Done - Celebração
  return (
    <Animated.View style={styles.container} entering={FadeIn}>
      <View style={styles.celebration}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
        <Text style={styles.celebrationTitle}>Pronto para começar!</Text>
        <Text style={styles.celebrationSubtitle}>
          Seu treino personalizado já está preparado
        </Text>
      </View>

      <PrimaryButton
        title="Ir para o App 💪"
        onPress={completeOnboarding}
        variant="success"
        style={styles.cta}
      />
    </Animated.View>
  )
}

const BenefitRow = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.benefitRow}>
    <Text style={styles.benefitIcon}>{icon}</Text>
    <Text style={styles.benefitText}>{text}</Text>
  </View>
)

const OptionButton = ({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string
  title: string
  subtitle: string
  onPress: () => void
}) => (
  <Pressable style={styles.option} onPress={onPress}>
    <Text style={styles.optionIcon}>{icon}</Text>
    <Text style={styles.optionTitle}>{title}</Text>
    <Text style={styles.optionSubtitle}>{subtitle}</Text>
  </Pressable>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  benefits: {
    marginBottom: 40,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  benefitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  optionsContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  option: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  cta: {
    marginTop: 'auto',
  },
  skipText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  celebration: {
    alignItems: 'center',
    marginBottommarginBottom: 40,
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4ecdc4',
    marginBottom: 12,
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
})
