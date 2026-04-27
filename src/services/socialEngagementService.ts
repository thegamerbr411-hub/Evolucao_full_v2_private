/**
 * Service que integra:
 * Treino concluído → Calcula XP → Atualiza Ranking → Cria Post Social
 * 
 * Esse é o CORAÇÃO do loop de engajamento
 */

import { useSocialStore } from '../stores/useSocialStore';
import { calculateXpFromVolume } from '../features/progression/xp';
import { hydrateSocialFromBackend, processSocialWorkoutCompletion } from '../features/social/socialFlow';

export { calculateXpFromVolume };

// Interface do treino concluído (vem do WorkoutScreen)
export interface CompletedWorkoutPayload {
  userId: string;
  username: string;
  workoutType: string; // 'Peito', 'Costas', etc
  totalVolume: number; // em kg
  totalSets: number;
  exerciseCount: number;
  durationMinutes?: number;
}

/**
 * FUNÇÃO PRINCIPAL: Chamar quando treino for concluído
 * 
 * Isso vai:
 * 1. Calcular XP
 * 2. Atualizar store de gamificação
 * 3. Atualizar ranking
 * 4. Criar post no feed social
 */
export async function onWorkoutCompleted(payload: CompletedWorkoutPayload) {
  try {
    const socialStore = useSocialStore.getState();
    const result = await processSocialWorkoutCompletion(payload);
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

    if (isDev) {
      console.log('[SOCIAL_ENGAGEMENT] Treino concluido:', {
        username: payload.username,
        volume: payload.totalVolume,
        xpGained: result.xpGained,
        source: result.source,
        position: socialStore.getUserPosition(payload.userId),
      });
    }

    return {
      success: true,
      xpGained: result.xpGained,
      position: socialStore.getUserPosition(payload.userId),
      source: result.source,
    };
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error('[SOCIAL_ENGAGEMENT] Erro ao processar treino:', error);
    }
    return {
      success: false,
      error,
    };
  }
}

/**
 * Inicializar dados do social (chamado no app startup)
 * Carrega posts e ranking da API/storage
 */
export async function initializeSocialData(userId: string) {
  try {
    const hydrated = await hydrateSocialFromBackend(userId);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[SOCIAL_ENGAGEMENT] Social inicializado para:', userId, 'backend:', hydrated);
    }
    return hydrated;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error('[SOCIAL_ENGAGEMENT] Erro ao inicializar:', error);
    }
    return false;
  }
}

/**
 * Obter mensagem emotiva para exibir após treino
 * Baseada na posição no ranking
 */
export function getEngagementMessage(position: number, xpGained: number): string {
  const messages = {
    1: `🔥 LIDERANÇA! Você é o #1 em XP`,
    2: `🥈 Posição #2! Só mais ${position > 1 ? position - 1 : '?'} pontos para o topo`,
    3: `🥉 Top 3! Você está conquistando`,
    5: `💪 Top 5! Continue assim`,
    10: `📈 Top 10! Você está crescendo`,
    default: `💥 +${xpGained} XP! Continue treinando`,
  };

  const key = Object.keys(messages)
    .map(Number)
    .filter((k) => k <= position)
    .sort((a, b) => b - a)[0];

  return messages[key] || messages.default;
}

/**
 * Comparação com amigos (para competição)
 * Retorna quem passou você no ranking
 */
export function checkFriendsAheadInRanking(userId: string): any[] {
  const socialStore = useSocialStore.getState();
  const currentUser = socialStore.ranking.find((e) => e.userId === userId);
  const friends = socialStore.friends;

  if (!currentUser) return [];

  const friendsAhead = socialStore.ranking
    .filter((e) => e.userId !== userId && e.xp > currentUser.xp && friends.includes(e.userId))
    .slice(0, 3); // Top 3 amigos à frente

  return friendsAhead;
}
