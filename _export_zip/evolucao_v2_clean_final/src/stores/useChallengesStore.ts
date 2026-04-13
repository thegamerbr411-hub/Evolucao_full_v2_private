// src/stores/useChallengesStore.ts
import { create } from 'zustand'

export type ChallengeFrequency = 'daily' | 'weekly' | 'monthly'

export type Challenge = {
  id: string
  title: string
  description: string
  type: 'workout' | 'nutrition' | 'streak' | 'volume'
  frequency: ChallengeFrequency
  goal: number
  progress: number
  reward: number // XP
  completed: boolean
  completedAt?: number
}

type ChallengesStore = {
  challenges: Challenge[]
  completedToday: Set<string>

  setChallenges: (challenges: Challenge[]) => void
  progressChallenge: (challengeId: string, amount?: number) => void
  completeChallenge: (challengeId: string) => void
  resetDaily: () => void
}

export const useChallengesStore = create<ChallengesStore>((set, get) => ({
  challenges: [
    {
      id: 'daily-workout',
      title: '1 treino hoje',
      description: 'Complete um treino',
      type: 'workout',
      frequency: 'daily',
      goal: 1,
      progress: 0,
      reward: 100,
      completed: false,
    },
    {
      id: 'daily-water',
      title: '2L de água',
      description: 'Beba 2 litros',
      type: 'nutrition',
      frequency: 'daily',
      goal: 2000,
      progress: 0,
      reward: 50,
      completed: false,
    },
    {
      id: 'weekly-4x',
      title: 'Treinar 4x na semana',
      type: 'streak',
      frequency: 'weekly',
      goal: 4,
      progress: 0,
      reward: 500,
      description: '',
      completed: false,
    },
    {
      id: 'weekly-volume',
      title: '10k+ kg de volume',
      type: 'volume',
      frequency: 'weekly',
      goal: 10000,
      progress: 0,
      reward: 300,
      description: '',
      completed: false,
    },
  ],
  completedToday: new Set(),

  setChallenges: (challenges) => set({ challenges }),

  progressChallenge: (challengeId, amount = 1) => {
    set((state) => ({
      challenges: state.challenges.map((challenge) => {
        if (challenge.id === challengeId && !challenge.completed) {
          const newProgress = Math.min(challenge.progress + amount, challenge.goal)
          return {
            ...challenge,
            progress: newProgress,
            completed: newProgress >= challenge.goal,
            completedAt: newProgress >= challenge.goal ? Date.now() : undefined,
          }
        }
        return challenge
      }),
    }))
  },

  completeChallenge: (challengeId) => {
    set((state) => {
      const newCompleted = new Set(state.completedToday)
      newCompleted.add(challengeId)

      return {
        challenges: state.challenges.map((c) =>
          c.id === challengeId ? { ...c, completed: true, completedAt: Date.now() } : c
        ),
        completedToday: newCompleted,
      }
    })
  },

  resetDaily: () => {
    set((state) => ({
      challenges: state.challenges.map((c) =>
        c.frequency === 'daily'
          ? { ...c, progress: 0, completed: false }
          : c
      ),
      completedToday: new Set(),
    }))
  },
}))

/**
 * Calcula total XP dos desafios completados hoje
 */
export const getTodayXP = (): number => {
  const { challenges, completedToday } = useChallengesStore.getState()
  return challenges
    .filter((c) => completedToday.has(c.id) && c.frequency === 'daily')
    .reduce((sum, c) => sum + c.reward, 0)
}

/**
 * Próximo milestone de desafios
 */
export const getMilestoneMessage = (xpToday: number): string | null => {
  if (xpToday === 0) return '0 XP hoje - bora ativar!'
  if (xpToday < 100) return `${xpToday} XP - quase lá!`
  if (xpToday >= 150) return `🔥 ${xpToday} XP - INSANO! 🔥`
  return null
}
