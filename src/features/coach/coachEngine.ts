// src/features/coach/coachEngine.ts
/**
 * ENGINE DO COACH INTELIGENTE
 * 
 * Mensagens baseadas em:
 * - Set atual
 * - RPE
 * - Histórico
 * - Recuperação
 */

type CoachContext = {
  exercise: string | null
  set: number
  rpe?: number
  isResting: boolean
  lastWorkoutRPE?: number
  streak: number
}

export const getCoachMessage = (context: CoachContext): string | null => {
  const { exercise, set, rpe, isResting, lastWorkoutRPE, streak } = context

  if (!exercise) return null

  // ⚠️ Recuperação baixa
  if (lastWorkoutRPE && lastWorkoutRPE >= 9.5) {
    return '⚠️ Sua recuperação está baixa. Reduz a carga hoje'
  }

  // 🔥 Setup - primeira série
  if (set === 0) {
    return '🔥 Começa leve pra aquecar. Qualidade acima de peso'
  }

  // 😤 Descansando
  if (isResting) {
    return '😤 Respira fundo. Ainda faltam séries'
  }

  // 🎯 Series de trabalho
  if (set >= 1 && set <= 2) {
    return '🎯 Controla a execução. Mente no musculo'
  }

  // 🔥 Últimas séries
  if (set >= 3) {
    if (rpe && rpe <= 7) {
      return '💪 Ainda tem corda! Força mais'
    }
    return '🔥 ÚLTIMA série. Vai no limite'
  }

  // 🏁 Genérico
  return '💪 Bora. Foco na técnica'
}

/**
 * Progressão inteligente de carga
 */
type ProgressionContext = {
  lastWeight: number
  lastReps: number
  targetReps: number
  lastRPE?: number
  successRate: number // % de vezes que bateu rep
}

export const getLoadProgression = (context: ProgressionContext) => {
  const { lastWeight, lastReps, targetReps, lastRPE, successRate } = context

  // Sem histórico
  if (!lastWeight) {
    return {
      suggestedWeight: 10,
      message: 'Comece com peso leve',
    }
  }

  // Foi fácil (RPE baixo + bateu reps)
  if (lastRPE && lastRPE <= 7 && lastReps >= targetReps && successRate > 0.8) {
    return {
      suggestedWeight: lastWeight + 2.5,
      message: '↗️ Aumenta 2.5kg - foi leve demais',
    }
  }

  // Ideal (RPE 8-9 + bateu reps)
  if (
    lastRPE &&
    lastRPE >= 8 &&
    lastRPE <= 9 &&
    lastReps >= targetReps &&
    successRate > 0.7
  ) {
    return {
      suggestedWeight: lastWeight,
      message: '✅ Mantém esse peso - tá bom demais',
    }
  }

  // Pesado demais
  if (lastRPE && lastRPE >= 10) {
    return {
      suggestedWeight: lastWeight - 2.5,
      message: '⚠️ Reduz 2.5kg - muito pesado',
    }
  }

  // Não bateu reps
  if (lastReps < targetReps) {
    return {
      suggestedWeight: lastWeight - 2.5,
      message: '⬇️ Reduz - não bateu as reps',
    }
  }

  return {
    suggestedWeight: lastWeight,
    message: '➡️ Mantém. Consolida mais um treino',
  }
}

/**
 * Detectar fadiga/overtraining
 */
export const detectFatigue = (context: {
  recentRPEs: number[]
  streak: number
  daysWithoutRest: number
}): string | null => {
  const { recentRPEs, streak, daysWithoutRest } = context

  // Média RPE nos últimos 3 treinos
  const avgRPE = recentRPEs.slice(-3).reduce((a, b) => a + b, 0) / 3

  // Muito cansado
  if (avgRPE >= 9.2 && daysWithoutRest >= 5) {
    return '⚠️ Sinais de overtraining. Descansa hoje'
  }

  // Cansado, mas pode treinar
  if (avgRPE >= 9 && daysWithoutRest >= 4) {
    return 'Tá pesado. Faz só uns exercícios leves'
  }

  return null
}
