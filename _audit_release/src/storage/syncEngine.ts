// src/storage/syncEngine.ts
import { getQueue, removeFromQueue, incrementAttempt, getQueueSize } from './syncQueue'
import api from '../services/api'
import { useAppStore } from '../stores/useAppStore'

const MAX_ATTEMPTS = 3

/**
 * Core - sincroniza todos items da fila com backend
 */
export const syncAll = async (): Promise<void> => {
  const queue = getQueue()

  if (queue.length === 0) {
    return
  }

  // Marca como sincronizando
  useAppStore.getState().setSyncing(true)

  for (const item of queue) {
    // Não tenta mais se já tentou 3x
    if (item.attempt >= MAX_ATTEMPTS) {
      removeFromQueue(item.id)
      continue
    }

    try {
      // Envia pro backend
      await api.post(`/sync`, item)

      // Remove da fila se sucesso
      removeFromQueue(item.id)
    } catch (error) {
      // Incrementa tentativa
      incrementAttempt(item.id)

      console.warn(`Sync failed for item ${item.id}, attempt ${item.attempt + 1}`)
    }
  }

  useAppStore.getState().setSyncing(false)
}

/**
 * Hook listener - auto-sync quando conecta
 */
export const setupAutoSync = () => {
  // Você precisa de NetInfo pra isso
  // import NetInfo from '@react-native-community/netinfo'

  // NetInfo.addEventListener((state) => {
  //   if (state.isConnected) {
  //     syncAll()
  //   }
  // })

  console.log('Auto sync disabled - setup NetInfo listener')
}

/**
 * Tenta sync de verdade (chamado periodicamente ou quando app volta)
 */
export const trySyncWithBackend = async (): Promise<boolean> => {
  try {
    const queueSize = getQueueSize()

    if (queueSize === 0) {
      return true
    }

    await syncAll()
    return true
  } catch (error) {
    console.error('Error syncing with backend:', error)
    return false
  }
}
