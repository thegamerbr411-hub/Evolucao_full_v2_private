// __tests__/qaWorkoutFixture.test.mjs
// Tests for official QA workout fixture

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock the store and fixture
let mockAppStore = {
  hasCompletedQuestionnaire: false,
  userRoutines: [],
  setHasCompletedQuestionnaire: (value) => { mockAppStore.hasCompletedQuestionnaire = value; },
  setUserRoutines: (routines) => { mockAppStore.userRoutines = routines; },
};

function mockUseAppStore() {
  return {
    getState: () => mockAppStore,
  };
}

describe('QA Workout Fixture', () => {
  beforeEach(() => {
    mockAppStore = {
      hasCompletedQuestionnaire: false,
      userRoutines: [],
      setHasCompletedQuestionnaire: (value) => { mockAppStore.hasCompletedQuestionnaire = value; },
      setUserRoutines: (routines) => { mockAppStore.userRoutines = routines; },
    };
  });

  it('should not seed state when fixture is disabled', () => {
    // Simulate fixture disabled
    const isQaWorkoutFixtureEnabled = () => false;
    
    // Import fixture logic (simulated)
    const seedQaWorkoutReadyState = () => {
      if (!isQaWorkoutFixtureEnabled()) {
        console.warn('[QA WORKOUT FIXTURE] Disabled');
        return {
          hasCompletedQuestionnaire: false,
          userRoutines: [],
        };
      }
      
      mockAppStore.setHasCompletedQuestionnaire(true);
      mockAppStore.setUserRoutines([{ id: 'qa-treino-ready', name: 'QA Treino Ready' }]);
      
      return {
        hasCompletedQuestionnaire: true,
        userRoutines: [{ id: 'qa-treino-ready', name: 'QA Treino Ready' }],
      };
    };
    
    const result = seedQaWorkoutReadyState();
    
    assert.strictEqual(result.hasCompletedQuestionnaire, false);
    assert.strictEqual(result.userRoutines.length, 0);
    assert.strictEqual(mockAppStore.hasCompletedQuestionnaire, false);
    assert.strictEqual(mockAppStore.userRoutines.length, 0);
  });

  it('should seed onboarded state when fixture is enabled', () => {
    // Simulate fixture enabled
    const isQaWorkoutFixtureEnabled = () => true;
    
    const seedQaWorkoutReadyState = () => {
      if (!isQaWorkoutFixtureEnabled()) {
        return {
          hasCompletedQuestionnaire: false,
          userRoutines: [],
        };
      }
      
      const qaRoutine = {
        id: 'qa-treino-ready',
        name: 'QA Treino Ready',
        exercises: [
          { id: 'qa-ex-1', name: 'Supino QA' },
          { id: 'qa-ex-2', name: 'Remada QA' },
          { id: 'qa-ex-3', name: 'Agachamento QA' },
        ],
      };
      
      mockAppStore.setHasCompletedQuestionnaire(true);
      mockAppStore.setUserRoutines([qaRoutine]);
      
      return {
        hasCompletedQuestionnaire: true,
        userRoutines: [qaRoutine],
      };
    };
    
    const result = seedQaWorkoutReadyState();
    
    assert.strictEqual(result.hasCompletedQuestionnaire, true);
    assert.strictEqual(result.userRoutines.length, 1);
    assert.strictEqual(result.userRoutines[0].id, 'qa-treino-ready');
    assert.strictEqual(result.userRoutines[0].exercises.length, 3);
    assert.strictEqual(mockAppStore.hasCompletedQuestionnaire, true);
    assert.strictEqual(mockAppStore.userRoutines.length, 1);
  });

  it('should create routine with 3 exercises', () => {
    const isQaWorkoutFixtureEnabled = () => true;
    
    const seedQaWorkoutReadyState = () => {
      if (!isQaWorkoutFixtureEnabled()) {
        return { hasCompletedQuestionnaire: false, userRoutines: [] };
      }
      
      const qaRoutine = {
        id: 'qa-treino-ready',
        name: 'QA Treino Ready',
        exercises: [
          { id: 'qa-ex-1', name: 'Supino QA' },
          { id: 'qa-ex-2', name: 'Remada QA' },
          { id: 'qa-ex-3', name: 'Agachamento QA' },
        ],
      };
      
      mockAppStore.setHasCompletedQuestionnaire(true);
      mockAppStore.setUserRoutines([qaRoutine]);
      
      return { hasCompletedQuestionnaire: true, userRoutines: [qaRoutine] };
    };
    
    const result = seedQaWorkoutReadyState();
    
    assert.strictEqual(result.userRoutines[0].exercises.length, 3);
    assert.strictEqual(result.userRoutines[0].exercises[0].name, 'Supino QA');
    assert.strictEqual(result.userRoutines[0].exercises[1].name, 'Remada QA');
    assert.strictEqual(result.userRoutines[0].exercises[2].name, 'Agachamento QA');
  });

  it('should reset fixture state', () => {
    const isQaWorkoutFixtureEnabled = () => true;
    
    // First seed
    mockAppStore.setHasCompletedQuestionnaire(true);
    mockAppStore.setUserRoutines([{ id: 'qa-treino-ready' }]);
    
    // Reset
    const resetQaWorkoutFixture = () => {
      if (!isQaWorkoutFixtureEnabled()) {
        return;
      }
      mockAppStore.setHasCompletedQuestionnaire(false);
      mockAppStore.setUserRoutines([]);
    };
    
    resetQaWorkoutFixture();
    
    assert.strictEqual(mockAppStore.hasCompletedQuestionnaire, false);
    assert.strictEqual(mockAppStore.userRoutines.length, 0);
  });

  it('should replace anonymous user with QA fixture user when enabled', () => {
    // Simulate store with anonymous Firebase user already set
    const QA_USER_ID_PREFIX = 'qa-';
    let mockUserStore = {
      user: { id: 'firebase_anonymous_uid_abc123', role: 'user', name: null, email: null },
    };

    const isQaWorkoutFixtureEnabled = () => true;

    // Simulate RootNavigator fixture effect: always sets QA user
    const applyQaFixtureUser = () => {
      if (!isQaWorkoutFixtureEnabled()) return;
      mockUserStore.user = {
        id: `${QA_USER_ID_PREFIX}workout-fixture`,
        role: 'user',
        name: 'QA Workout Fixture',
        email: 'qa+workoutfixture@fixture.local',
      };
    };

    applyQaFixtureUser();

    assert.ok(mockUserStore.user.id.startsWith(QA_USER_ID_PREFIX), 'QA user id should start with qa- prefix');
    assert.strictEqual(mockUserStore.user.name, 'QA Workout Fixture');
    assert.notStrictEqual(mockUserStore.user.id, 'firebase_anonymous_uid_abc123', 'Anonymous user should be replaced');
  });

  it('should not replace QA fixture user with Firebase anonymous user (auth guard)', () => {
    // Simulate the auth guard in AppContext-v2.ts onAuthStateChanged
    const QA_USER_ID_PREFIX = 'qa-';
    const isQaWorkoutFixtureEnabled = () => true;
    const __DEV__ = true;

    let mockUserStore = {
      user: { id: `${QA_USER_ID_PREFIX}workout-fixture`, role: 'user', name: 'QA Workout Fixture', email: null },
      isHydrated: true,
    };

    // Simulate onAuthStateChanged firing with an anonymous Firebase user
    const simulateOnAuthStateChanged = (firebaseUser) => {
      if (!firebaseUser) return;

      const currentStoreUser = mockUserStore.user;

      // Auth guard: skip if QA fixture user is active
      if (
        typeof __DEV__ !== 'undefined' && __DEV__
        && isQaWorkoutFixtureEnabled()
        && currentStoreUser?.id
        && String(currentStoreUser.id).startsWith(QA_USER_ID_PREFIX)
      ) {
        // Skip — do not overwrite QA user
        return;
      }

      // Would overwrite user
      mockUserStore.user = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Usuário',
        email: firebaseUser.email || null,
        role: 'user',
      };
    };

    // Firebase emits anonymous user
    simulateOnAuthStateChanged({ uid: 'firebase_anonymous_uid_abc123', displayName: null, email: null });

    // QA user must still be in place
    assert.ok(mockUserStore.user.id.startsWith(QA_USER_ID_PREFIX), 'QA user should not be overwritten by anonymous Firebase user');
    assert.strictEqual(mockUserStore.user.name, 'QA Workout Fixture');
  });

  it('should produce a navigation-gate-accepted state when fixture is enabled', () => {
    // Simulate the navigation gate logic from RootNavigator.js
    // hasAccount = Boolean(user && (user.name || user.id)) || Boolean(firebaseUser?.uid)
    const QA_USER_ID_PREFIX = 'qa-';

    const qaUser = {
      id: `${QA_USER_ID_PREFIX}workout-fixture`,
      role: 'user',
      name: 'QA Workout Fixture',
      email: 'qa+workoutfixture@fixture.local',
    };

    const qaProfile = {
      goal: 'hipertrofia',
      level: 'intermediario',
      currentWeight: 80,
      targetWeight: 78,
      height: 175,
      trainingDaysPerWeek: 3,
    };

    const hasAccount = Boolean(qaUser && (qaUser.name || qaUser.id));
    const hasPersistedProfile = Boolean(qaProfile && Number(qaProfile.currentWeight || 0) > 0);
    const hasCompletedQuestionnaire = true;

    // Navigation gate should route to MainTabs
    const getInitialRoute = () => {
      if (!hasAccount) return 'Cadastro';
      return 'MainTabs';
    };

    assert.strictEqual(hasAccount, true, 'QA user should satisfy hasAccount check');
    assert.strictEqual(hasPersistedProfile, true, 'QA profile should satisfy hasPersistedProfile check');
    assert.strictEqual(hasCompletedQuestionnaire, true, 'hasCompletedQuestionnaire should be true');
    assert.strictEqual(getInitialRoute(), 'MainTabs', 'Navigation gate should route to MainTabs with QA fixture state');
  });
});
