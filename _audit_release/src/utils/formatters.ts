// src/utils/formatters.ts
/**
 * Utilitários de formatação pra UX ficar limpa
 */

/**
 * Formata peso + reps sem mostrar "0kg x 0"
 */
export const formatSetDisplay = (
  weight?: number,
  reps?: number,
  sets?: number
): string | null => {
  // Se nada está setado, retorna null (mostra placeholder)
  if (!weight || !reps || !sets) {
    return null
  }

  // Se tudo é 0, retorna null
  if (weight === 0 && reps === 0 && sets === 0) {
    return null
  }

  return `${weight}kg × ${reps} (${sets}×)`
}

/**
 * Formata RPE de forma simples
 */
export const formatRPE = (rpe?: number): string => {
  if (!rpe) return '--'
  return `${rpe.toFixed(1)}/10`
}

/**
 * Formata volume
 */
export const formatVolume = (weight?: number, reps?: number, sets?: number): string => {
  if (!weight || !reps || !sets) return '0kg'

  const total = weight * reps * sets
  return `${Math.round(total)}kg`
}

/**
 * Formata XP de forma amigável
 */
export const formatXP = (xp?: number): string => {
  if (!xp) return '0 XP'
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k XP`
  return `${Math.round(xp)} XP`
}

/**
 * Formata streak
 */
export const formatStreak = (days: number): string => {
  if (days === 0) return 'Sem sequência'
  if (days === 1) return '1 dia 🔥'
  if (days >= 3) return `${days} dias 🔥🔥🔥`
  return `${days} dias 🔥`
}

/**
 * Formata data pra aparecer amigável
 */
export const formatDateFriendly = (iso: string): string => {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Hoje'
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem'
  }

  return date.toLocaleDateString('pt-BR', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Valida reps/weight antes de salvar
 */
export const validateExerciseInput = (
  weight?: number,
  reps?: number,
  sets?: number
): { valid: boolean; error?: string } => {
  if (!weight || weight <= 0) {
    return { valid: false, error: 'Peso inválido' }
  }

  if (!reps || reps <= 0) {
    return { valid: false, error: 'Reps inválido' }
  }

  if (!sets || sets <= 0) {
    return { valid: false, error: 'Sets inválido' }
  }

  return { valid: true }
}
