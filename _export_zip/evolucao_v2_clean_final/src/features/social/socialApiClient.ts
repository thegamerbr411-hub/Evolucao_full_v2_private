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
  xpGained: number;
  ranking?: any[];
  feed?: any[];
  position?: number;
};

export async function postCompletedWorkout(payload: SocialWorkoutPayload): Promise<SocialStateResponse | null> {
  try {
    const { data } = await api.post('/social/workouts/complete', payload);
    return data || null;
  } catch (error) {
    return null;
  }
}

export async function fetchSocialState(userId: string): Promise<SocialStateResponse | null> {
  try {
    const { data } = await api.get(`/social/state?userId=${encodeURIComponent(userId)}`);
    return data || null;
  } catch (error) {
    return null;
  }
}
