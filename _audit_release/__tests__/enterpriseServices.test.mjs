import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateUserScore, getUserRank, sortRanking } from '../src/services/rankingService.js';
import { getActiveMissionsForUser, rewardMission } from '../src/services/missionService.js';
import { getPlanLimits, isWithinPlanLimit } from '../src/services/saasService.js';
import { getPlanName, isPro } from '../src/services/billingService.js';

test('rankingService calcula score e ranking corretamente', () => {
  const users = [
    { id: 'u1', xp: 1200, streakDays: 5, totalWorkouts: 20 },
    { id: 'u2', xp: 1600, streakDays: 2, totalWorkouts: 10 },
    { id: 'u3', xp: 1000, streakDays: 10, totalWorkouts: 25 },
  ];

  assert.equal(calculateUserScore(users[0]), 2700);

  const ordered = sortRanking(users);
  assert.equal(ordered[0].id, 'u3');
  assert.equal(getUserRank(users, 'u2'), 3);
});

test('missionService retorna missoes e recompensa com saveFn', async () => {
  const user = {
    waterMlToday: 2200,
    proteinToday: 180,
    proteinTarget: 150,
    trainedToday: true,
    weeklyWorkouts: 4,
    streakDays: 5,
  };

  const missions = getActiveMissionsForUser(user);
  assert.ok(missions.length >= 5);
  assert.ok(missions.every((item) => item.completed === true));

  let savedPayload = null;
  const result = await rewardMission({
    userId: 'u1',
    missionId: 'daily_train',
    rewardXP: 150,
    saveFn: async (payload) => {
      savedPayload = payload;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(savedPayload.userId, 'u1');
});

test('saasService e billingService aplicam limites e plano corretamente', () => {
  const freeLimits = getPlanLimits('free');
  assert.equal(freeLimits.aiPerDay, 5);

  assert.equal(isWithinPlanLimit({ plan: 'free', type: 'ai', used: 4 }), true);
  assert.equal(isWithinPlanLimit({ plan: 'free', type: 'ai', used: 5 }), false);

  assert.equal(getPlanName({ plan: 'team' }), 'team');
  assert.equal(isPro({ plan: 'pro' }), true);
  assert.equal(isPro({ plan: 'free' }), false);
});
