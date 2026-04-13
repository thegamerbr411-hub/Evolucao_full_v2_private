// src/features/coach/useCoach.ts
import { useMemo } from 'react'
import { useWorkoutStore } from '../../stores/useWorkoutStore'
import { useCoachStore } from '../../stores/useCoachStore'
import { getCoachMessage, getLoadProgression } from './coachEngine'

/**
 * Hook principal do Coach Inteligente
 * Retorna mensagem + sugestão de carga baseado em contexto atual
 */
export const useCoach = (exerciseHistory?: any[]) => {
  const { currentExercise, currentSet, isResting } = useWorkoutStore()
  const { setMessage, setLoadSuggestion } = useCoachStore()

  // Mensagem do coach baseada em set atual
  const coachMessage = useMemo(() => {
    if (!currentExercise) return null

    const lastRPE = exerciseHistory?.[0]?.rpe

    return getCoachMessage({
      exercise: currentExercise.name,
      set: currentSet,
      rpe: lastRPE,
      isResting,
      lastWorkoutRPE: lastRPE,
      streak: 0, // você buscaria do store
    })
  }, [currentExercise, currentSet, isResting, exerciseHistory])

  // Sugestão de carga para próxima série
  const loadSuggestion = useMemo(() => {
    if (!exerciseHistory || exerciseHistory.length === 0) return null

    const last = exerciseHistory[0]

    return getLoadProgression({
      lastWeight: last.weight,
      lastReps: last.reps,
      targetReps: 10, // seu target
      lastRPE: last.rpe,
      successRate: 0.8, // seria calculado
    })
  }, [exerciseHistory])

  return {
    message: coachMessage,
    loadSuggestion,
  }
}
