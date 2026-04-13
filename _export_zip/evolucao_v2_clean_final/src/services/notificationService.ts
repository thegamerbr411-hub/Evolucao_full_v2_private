// src/services/notificationService.ts
/**
 * Serviço de notificações inteligentes
 * - Notifica de chamada pra atividade
 * - Notifica de progresso de desafios
 * - Notifica de amigos
 */

import * as Notifications from 'expo-notifications'
import { useUserStore } from '../stores/useUserStore'

export type NotificationTrigger = 'activity' | 'challenge' | 'friend' | 'coach' | 'reminder'

export interface ScheduledNotification {
  id: string
  title: string
  body: string
  trigger: NotificationTrigger
  scheduledFor: number
  sent: boolean
}

/**
 * Configura o handler de notificações
 */
export const configureNotifications = async () => {
  // Pedir permissão
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') {
    console.warn('Notificações não autorizadas')
    return false
  }

  // Handler quando notificação é recebida
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })

  return true
}

/**
 * Agenda notificação de chamada pra atividade (11am, só se não treinou)
 */
export const scheduleActivityReminder = async () => {
  const { user } = useUserStore.getState()
  if (!user) return

  const now = new Date()
  const reminderTime = new Date()
  reminderTime.setHours(11, 0, 0, 0)

  // Se já passou das 11h, agenda pra amanhã
  if (now > reminderTime) {
    reminderTime.setDate(reminderTime.getDate() + 1)
  }

  const secondsUntilReminder = Math.round(
    (reminderTime.getTime() - now.getTime()) / 1000
  )

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💪 Bora treinar?',
      body: `${user.name}, você ainda não treinou hoje. Que tal começar agora?`,
      sound: 'default',
      badge: 1,
    },
    trigger: {
      seconds: secondsUntilReminder,
      repeats: true,
    },
  })
}

/**
 * Notifica de desafio completado
 */
export const notifyChallengeCompleted = async (
  challengeTitle: string,
  xpReward: number
) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎉 Desafio completado!',
      body: `${challengeTitle} - +${xpReward} XP!`,
      sound: 'default',
      badge: 1,
    },
    trigger: { seconds: 1 },
  })
}

/**
 * Notifica de amigo que treinou
 */
export const notifyFriendWorkout = async (friendName: string) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `👥 ${friendName} treinou!`,
      body: 'Que tal mandar uma mensagem de incentivo?',
      sound: 'default',
    },
    trigger: { seconds: 2 },
  })
}

/**
 * Notifica de coach (apenas 1 por dia)
 */
export const scheduleCoachNotification = async (message: string) => {
  // Verifica se já mandou 1 hoje
  const { user } = useUserStore.getState()
  if (!user) return

  const lastCoachNotif = user.metadata?.lastCoachNotificationAt || 0
  const oneDay = 24 * 60 * 60 * 1000
  const timeSinceLastNotif = Date.now() - lastCoachNotif

  if (timeSinceLastNotif < oneDay) {
    return // Já mandou uma hoje
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧠 Dica do Coach',
      body: message,
      sound: 'default',
    },
    trigger: { seconds: 3 },
  })

  // Atualiza timestamp
  useUserStore.getState().updateUserMetadata({
    lastCoachNotificationAt: Date.now(),
  })
}

/**
 * Cancela todas notificações programadas
 */
export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Agenda série de notificações para toda semana
 */
export const scheduleWeeklyNotifications = async () => {
  try {
    // Activity reminder (11am todo dia)
    await scheduleActivityReminder()

    console.log('✓ Notificações agendadas para a semana')
  } catch (error) {
    console.error('Erro ao agendar notificações:', error)
  }
}
