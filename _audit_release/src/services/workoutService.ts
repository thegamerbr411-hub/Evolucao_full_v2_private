// src/services/workoutService.ts
/**
 * Serviço de treino com suporte offline+sync
 */

import { getLocal, setLocal } from '../storage/mmkv'
import { addToQueue } from '../storage/syncQueue'
import api from './api'

const WORKOUTS_KEY = 'workouts'

type Workout = {
  id: string
  date: string
  exercise: string
  weight: number
  reps: number
  sets: number
  rpe?: number
  notes?: string
  syncedAt?: number
}

/**
 * SALVAR TREINO (OFFLINE + SYNC)
 * 
 * 1. Salva local
 * 2. Adiciona fila de sync
 * 3. Tenta enviar pro backend SE online
 */
export const saveWorkout = async (workout: Omit<Workout, 'id'>): Promise<Workout> => {
  try {
    const newWorkout: Workout = {
      ...workout,
      id: Math.random().toString(36).substr(2, 9),
    }

    // 1️⃣ Salva local
    const workouts = getLocal(WORKOUTS_KEY) || []
    workouts.push(newWorkout)
    setLocal(WORKOUTS_KEY, workouts)

    // 2️⃣ Adiciona fila de sync
    addToQueue({
      type: 'workout',
      data: newWorkout,
    })

    // 3️⃣ Tenta enviar direto se online
    try {
      await api.post('/workouts', newWorkout)
      newWorkout.syncedAt = Date.now()
      updateWorkout(newWorkout)
    } catch (e) {
      console.warn('Workout salvo local, aguardando sync:', e)
    }

    return newWorkout
  } catch (error) {
    console.error('Error saving workout:', error)
    throw error
  }
}

/**
 * GET WORKOUTS (LOCAL)
 */
export const getWorkouts = (): Workout[] => {
  return getLocal(WORKOUTS_KEY) || []
}

/**
 * GET WORKOUT BY ID
 */
export const getWorkout = (id: string): Workout | null => {
  const workouts = getWorkouts()
  return workouts.find((w) => w.id === id) || null
}

/**
 * UPDATE WORKOUT
 */
export const updateWorkout = (workout: Workout): void => {
  try {
    const workouts = getLocal(WORKOUTS_KEY) || []
    const index = workouts.findIndex((w: Workout) => w.id === workout.id)

    if (index >= 0) {
      workouts[index] = workout
      setLocal(WORKOUTS_KEY, workouts)
    }
  } catch (error) {
    console.error('Error updating workout:', error)
  }
}

/**
 * DELETE WORKOUT
 */
export const deleteWorkout = (id: string): void => {
  try {
    const workouts = getLocal(WORKOUTS_KEY) || []
    const filtered = workouts.filter((w: Workout) => w.id !== id)
    setLocal(WORKOUTS_KEY, filtered)

    // Tenta também no backend
    api.delete(`/workouts/${id}`).catch((e) => {
      console.warn('Error deleting from backend:', e)
    })
  } catch (error) {
    console.error('Error deleting workout:', error)
  }
}

/**
 * GET WORKOUTS BY DATE
 */
export const getWorkoutsByDate = (date: string): Workout[] => {
  const workouts = getWorkouts()
  return workouts.filter((w) => w.date === date)
}

/**
 * GET VOLUME (TREINO DO DIA)
 */
export const getDayVolume = (date: string): number => {
  const dayWorkouts = getWorkoutsByDate(date)
  return dayWorkouts.reduce((total, w) => {
    return total + w.weight * w.reps * w.sets
  }, 0)
}
