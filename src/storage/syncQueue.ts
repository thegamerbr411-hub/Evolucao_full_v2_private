// src/storage/syncQueue.ts
import { getLocal, setLocal, removeLocal } from './mmkv'

export type SyncItem = {
  id: string
  type: 'workout' | 'nutrition' | 'profile' | 'other'
  data: any
  createdAt: number
  attempt: number
}

const SYNC_QUEUE_KEY = 'syncQueue'
const MAX_ATTEMPTS = 3

/**
 * Adiciona item na fila de sync
 */
export const addToQueue = (item: Omit<SyncItem, 'id' | 'createdAt' | 'attempt'>): void => {
  try {
    const queue = getLocal(SYNC_QUEUE_KEY) || []

    const newItem: SyncItem = {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      attempt: 0,
    }

    queue.push(newItem)
    setLocal(SYNC_QUEUE_KEY, queue)
  } catch (e) {
    console.error('Error adding to queue:', e)
  }
}

/**
 * Retorna fila de sync
 */
export const getQueue = (): SyncItem[] => {
  return getLocal(SYNC_QUEUE_KEY) || []
}

/**
 * Remove item da fila
 */
export const removeFromQueue = (itemId: string): void => {
  try {
    const queue = getLocal(SYNC_QUEUE_KEY) || []
    const filtered = queue.filter((item: SyncItem) => item.id !== itemId)
    setLocal(SYNC_QUEUE_KEY, filtered)
  } catch (e) {
    console.error('Error removing from queue:', e)
  }
}

/**
 * Atualiza tentativa de sync
 */
export const incrementAttempt = (itemId: string): void => {
  try {
    const queue = getLocal(SYNC_QUEUE_KEY) || []
    const updated = queue.map((item: SyncItem) =>
      item.id === itemId ? { ...item, attempt: item.attempt + 1 } : item
    )
    setLocal(SYNC_QUEUE_KEY, updated)
  } catch (e) {
    console.error('Error incrementing attempt:', e)
  }
}

/**
 * Limpa fila completamente
 */
export const clearQueue = (): void => {
  try {
    removeLocal(SYNC_QUEUE_KEY)
  } catch (e) {
    console.error('Error clearing queue:', e)
  }
}

/**
 * Retorna size da fila
 */
export const getQueueSize = (): number => {
  return getQueue().length
}
