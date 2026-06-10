// src/qa/qaWorkoutFixture.ts
// Official QA fixture for pre-onboarded workout state
// Only active in development/QA environments

import Constants from 'expo-constants';
import { useAppStore } from '../stores/useAppStore';
import { WORKOUT_LIBRARY } from '../context/modules/workout';

/**
 * Prefix used for all QA fixture user IDs.
 * Auth handlers can check this prefix to avoid overwriting QA users.
 */
export const QA_USER_ID_PREFIX = 'qa-';

const QA_FIXTURE_ENABLED = (() => {
  // Check explicit env var or app.json extra — do NOT auto-enable for all __DEV__ builds
  // to avoid accidentally activating the fixture in regular development.
  const fromExtra = String(Constants.expoConfig?.extra?.qaWorkoutFixture || '').trim().toLowerCase();
  const fromEnv = String(
    (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_WORKOUT_FIXTURE : '')
    || ''
  ).trim().toLowerCase();
  return fromExtra === '1' || fromExtra === 'true' || fromEnv === '1' || fromEnv === 'true';
})();

export function isQaWorkoutFixtureEnabled(): boolean {
  return QA_FIXTURE_ENABLED;
}

export interface QaWorkoutReadyState {
  hasCompletedQuestionnaire: boolean;
  userRoutines: any[];
}

export function seedQaWorkoutReadyState(): QaWorkoutReadyState {
  if (!QA_FIXTURE_ENABLED) {
    console.warn('[QA WORKOUT FIXTURE] Disabled - set EXPO_PUBLIC_QA_WORKOUT_FIXTURE=1 or extra.qaWorkoutFixture=true');
    return {
      hasCompletedQuestionnaire: false,
      userRoutines: [],
    };
  }

  const appStore = useAppStore.getState();

  // QA Routine with 3 exercises
  const qaRoutine = {
    id: 'qa-treino-ready',
    name: 'QA Treino Ready',
    description: 'Rotina QA para validação de treino guiado multi-exercício',
    exercises: [
      {
        id: 'qa-ex-1',
        name: 'Supino QA',
        sets: 3,
        reps: '8-12',
        muscleGroup: 'peito',
      },
      {
        id: 'qa-ex-2',
        name: 'Remada QA',
        sets: 3,
        reps: '8-12',
        muscleGroup: 'costas',
      },
      {
        id: 'qa-ex-3',
        name: 'Agachamento QA',
        sets: 3,
        reps: '8-12',
        muscleGroup: 'perna',
      },
    ],
    trainingSplit: 'full',
    weeklyTarget: 3,
    createdAt: new Date().toISOString(),
  };

  // Set onboarded state
  appStore.setHasCompletedQuestionnaire(true);
  appStore.setUserRoutines([qaRoutine]);

  console.log('[QA WORKOUT FIXTURE] State seeded:', {
    hasCompletedQuestionnaire: true,
    userRoutines: [qaRoutine],
  });

  return {
    hasCompletedQuestionnaire: true,
    userRoutines: [qaRoutine],
  };
}

export function resetQaWorkoutFixture(): void {
  if (!QA_FIXTURE_ENABLED) {
    return;
  }

  const appStore = useAppStore.getState();
  appStore.setHasCompletedQuestionnaire(false);
  appStore.setUserRoutines([]);

  console.log('[QA WORKOUT FIXTURE] State reset');
}
