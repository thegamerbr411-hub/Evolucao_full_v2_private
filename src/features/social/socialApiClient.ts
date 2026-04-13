import api from '../../services/api';

export type SocialWorkoutPayload = {
  userId: string;
  username: string;
  workoutType: string;
  totalVolume: number;
  totalSets: number;
  exerciseCount: number;
  durationMinutes?: number;
};

export type SocialStateResponse = {
  xpGained?: number;
  xpTotal?: number;
  ranking?: any[];
  feed?: any[];
  position?: number;
};

function normalizeRanking(raw: any[] = []) {
  return raw.map((entry, index) => ({
    userId: String(entry?.userId || ''),
    username: String(entry?.userName || entry?.username || 'Usuario'),
    xp: Number(entry?.xp || 0),
    streak: Number(entry?.streak || 0),
    position: Number(entry?.position || index + 1),
  }));
}

function normalizeFeed(raw: any[] = []) {
  return raw.map((item) => ({
    id: String(item?.id || ''),
    userId: String(item?.userId || ''),
    username: String(item?.userName || item?.username || 'Usuario'),
    workoutType: String(item?.data?.workoutType || item?.workoutType || 'Treino'),
    volume: Number(item?.data?.totalVolume || item?.volume || 0),
    xpGained: Number(item?.xp || item?.xpGained || 0),
    exerciseCount: Number(item?.data?.exerciseCount || item?.exerciseCount || 0),
    totalSets: Number(item?.data?.totalSets || item?.totalSets || 0),
    createdAt: item?.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  }));
}

export async function postCompletedWorkout(payload: SocialWorkoutPayload): Promise<SocialStateResponse | null> {
  try {
    const gainedXp = Math.max(0, Math.round((Number(payload.totalVolume || 0) * 0.1)));

    await api.post('/ranking/add-xp', { xp: gainedXp });
    await api.post('/social/feed', {
      text: `${payload.username} concluiu treino ${payload.workoutType}`,
      xp: gainedXp,
      data: payload,
    });

    const [rankingRes, feedRes] = await Promise.all([
      api.get('/ranking'),
      api.get('/social/feed'),
    ]);

    const ranking = normalizeRanking(rankingRes?.data?.ranking || []);
    const feed = normalizeFeed(feedRes?.data?.feed || []);
    const current = ranking.find((entry) => entry.userId === payload.userId);

    return {
      xpGained: gainedXp,
      xpTotal: Number(current?.xp || 0),
      position: Number(current?.position || 0),
      ranking,
      feed,
    };
  } catch (error) {
    console.warn('[INTEGRATION][SOCIAL] Falha ao publicar treino social no backend');
    return null;
  }
}

export async function fetchSocialState(userId: string): Promise<SocialStateResponse | null> {
  try {
    const [rankingRes, feedRes] = await Promise.all([
      api.get('/ranking'),
      api.get('/social/feed'),
    ]);

    const ranking = normalizeRanking(rankingRes?.data?.ranking || []);
    const feed = normalizeFeed(feedRes?.data?.feed || []);
    const current = ranking.find((entry) => entry.userId === userId);

    return {
      xpTotal: Number(current?.xp || 0),
      position: Number(current?.position || 0),
      ranking,
      feed,
    };
  } catch (error) {
    console.warn('[INTEGRATION][SOCIAL] Falha ao hidratar estado social do backend');
    return null;
  }
}
