// src/features/onboarding/onboardingStore.ts
import { create } from 'zustand'

export type OnboardingStep = 'welcome' | 'goal' | 'level' | 'frequency' | 'done'

type OnboardingStore = {
  currentStep: OnboardingStep
  completed: boolean
  userData: {
    goal?: 'strength' | 'hypertrophy' | 'endurance' | 'fat_loss'
    level?: 'beginner' | 'intermediate' | 'advanced'
    frequency?: 'light' | 'moderate' | 'intense'
  }

  setStep: (step: OnboardingStep) => void
  setGoal: (goal: string) => void
  setLevel: (level: string) => void
  setFrequency: (frequency: string) => void
  completeOnboarding: () => void
  skipOnboarding: () => void
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  currentStep: 'welcome',
  completed: false,
  userData: {},

  setStep: (step) => set({ currentStep: step }),

  setGoal: (goal) => {
    set((state) => ({
      userData: { ...state.userData, goal: goal as any },
      currentStep: 'level',
    }))
  },

  setLevel: (level) => {
    set((state) => ({
      userData: { ...state.userData, level: level as any },
      currentStep: 'frequency',
    }))
  },

  setFrequency: (frequency) => {
    set((state) => ({
      userData: { ...state.userData, frequency: frequency as any },
      currentStep: 'done',
    }))
  },

  completeOnboarding: () => {
    set({ completed: true, currentStep: 'done' })
  },

  skipOnboarding: () => {
    set({ completed: true, currentStep: 'done' })
  },
}))

/**
 * Texto motivacional baseado no objetivo
 */
export const getGoalMessage = (goal?: string): string => {
  const messages: Record<string, string> = {
    strength: '💪 Força = Poder. Vamo ficar monstro!',
    hypertrophy: '📈 Hipertrofia = Volume. Pump garantido!',
    endurance: '⏱️ Resistência = Durabilidade. Nunca desista!',
    fat_loss: '🔥 Perda de Gordura = Foco. Sem parar!',
  }
  return messages[goal || ''] || '🎯 Vamo treinar!'
}

/**
 * Dificuldade recomendada de treino baseado no nível
 */
export const getRecommendedSplits = (level?: string): string[] => {
  const splits: Record<string, string[]> = {
    beginner: ['Full Body 3x/semana', 'Upper/Lower 2x/semana'],
    intermediate: ['Push/Pull/Leg', 'Upper/Lower 4x', 'Body Part Split'],
    advanced: ['Upper/Lower 4x', 'Push/Pull/Leg', 'Custom Split'],
  }
  return splits[level || 'beginner'] || []
}
