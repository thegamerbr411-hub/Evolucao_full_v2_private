import test from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_PROFILES, WORKOUT_SCENARIOS } from './fixtures/humanSimulationProfiles.mjs';
import { startServer } from '../dashboard/server.js';

function makeUrl(port, route) {
  return `http://127.0.0.1:${port}${route}`;
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { response, data };
}

function buildExercises(scenarioKey, includeNewExercise = false) {
  const base = [
    { name: 'Supino Reto', reps: 8, sets: 3, weight: 42 },
    { name: 'Remada Curvada', reps: 10, sets: 3, weight: 45 },
    { name: 'Agachamento', reps: 8, sets: 3, weight: 70 },
  ];

  if (!includeNewExercise) {
    return base;
  }

  return [
    ...base,
    { name: `Movimento Novo ${scenarioKey}`, reps: 12, sets: 2, weight: 18 },
  ];
}

test('simulacao humana real fullstack com variacao de comportamento', async () => {
  process.env.ADMIN_USER = 'admin';
  process.env.ADMIN_PASS = 'pass123';
  process.env.JWT_SECRET = 'test-secret';
  process.env.CLIENT_API_KEYS = JSON.stringify({ admin: '123456', qa_real: 'qa-key' });
  process.env.DEFAULT_CLIENT_ID = 'qa_real';
  process.env.APP_API_KEY = 'app-key-test';
  process.env.ENABLE_QA_LOCAL_BYPASS = '1';

  const server = startServer(0);
  const port = server.address().port;
  const stamp = Date.now();

  const apiHeaders = {
    'content-type': 'application/json',
    'x-api-key': 'app-key-test',
  };

  const qaHeaders = {
    'content-type': 'application/json',
    'x-qa-local': '1',
    'x-qa-client-id': `qa-real-${stamp}`,
  };

  const users = {
    free: `user_free_${stamp}`,
    premium: `user_premium_${stamp}`,
    friend: `user_friend_${stamp}`,
  };

  const pendingForSync = [];

  try {
    const login = await httpJson(makeUrl(port, '/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', pass: 'pass123' }),
    });
    assert.equal(login.response.status, 200);
    assert.ok(login.data?.token);

    const clientToken = await httpJson(makeUrl(port, '/token/client'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${login.data.token}`,
      },
      body: JSON.stringify({ clientId: `qa-real-${stamp}` }),
    });
    assert.equal(clientToken.response.status, 200);
    assert.ok(clientToken.data?.token);

    for (const [index, scenario] of WORKOUT_SCENARIOS.entries()) {
      const currentUser = index % 2 === 0 ? users.free : users.premium;
      const profile = HUMAN_PROFILES[index % HUMAN_PROFILES.length];
      const workoutPayload = {
        userId: currentUser,
        name: scenario.key,
        mode: scenario.mode,
        plan: currentUser === users.premium ? 'premium' : 'free',
        source: 'human-real-sim',
        totalSets: scenario.totalSets,
        totalVolume: scenario.totalVolume,
        durationMinutes: scenario.durationMinutes,
        missionsCompleted: scenario.missionsCompleted,
        createdAt: new Date(Date.now() - ((WORKOUT_SCENARIOS.length - index) * 3600 * 1000)).toISOString(),
        userTimezone: profile.timezone,
        exercises: buildExercises(scenario.key, scenario.newExercise),
      };

      const saveWorkout = await httpJson(makeUrl(port, '/api/workouts'), {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(workoutPayload),
      });

      assert.equal(saveWorkout.response.status, 200);
      assert.equal(saveWorkout.data?.ok, true);
      if (currentUser === users.free) {
        assert.equal(saveWorkout.data?.upgradeAvailable, true);
      }
      if (currentUser === users.premium) {
        assert.equal(saveWorkout.data?.subscriptionStatus, 'active');
      }

      if (!scenario.completed) {
        const abandonmentEvent = await httpJson(makeUrl(port, '/api/events'), {
          method: 'POST',
          headers: qaHeaders,
          body: JSON.stringify({
            event: 'flow_abandoned',
            screen: 'Workout',
            meta: {
              domain: 'workout',
              scenario: scenario.key,
              restPattern: scenario.restPattern,
              userId: currentUser,
            },
          }),
        });
        assert.equal(abandonmentEvent.response.status, 200);
      }
    }

    const hydrationEvents = [
      {
        userId: users.free,
        ml: 450,
        timezone: 'America/Sao_Paulo',
        occurredAt: '2026-04-10T23:58:00-03:00',
      },
      {
        userId: users.free,
        ml: 300,
        timezone: 'America/Sao_Paulo',
        occurredAt: '2026-04-11T00:04:00-03:00',
      },
      {
        userId: users.premium,
        ml: 1200,
        timezone: 'UTC',
        occurredAt: '2026-04-11T09:00:00Z',
      },
    ];

    for (const hydration of hydrationEvents) {
      const addHydration = await httpJson(makeUrl(port, '/api/hydration'), {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(hydration),
      });
      assert.equal(addHydration.response.status, 200);
      assert.equal(addHydration.data?.ok, true);
    }

    const hydrationDay1 = await httpJson(
      makeUrl(port, `/api/hydration?userId=${encodeURIComponent(users.free)}&dayKey=2026-04-10`),
      { headers: { ...apiHeaders, 'x-user-timezone': 'America/Sao_Paulo' } }
    );
    const hydrationDay2 = await httpJson(
      makeUrl(port, `/api/hydration?userId=${encodeURIComponent(users.free)}&dayKey=2026-04-11`),
      { headers: { ...apiHeaders, 'x-user-timezone': 'America/Sao_Paulo' } }
    );

    assert.equal(hydrationDay1.response.status, 200);
    assert.equal(hydrationDay2.response.status, 200);
    assert.ok(Number(hydrationDay1.data?.summary?.totalMl || 0) > 0);
    assert.ok(Number(hydrationDay2.data?.summary?.totalMl || 0) > 0);

    const nutritionEvents = [
      { label: 'frango+arroz', known: true, quantity: 1.3 },
      { label: 'alimento_inexistente_xyz', known: false, quantity: 2.1 },
      { label: 'whey+banana', known: true, quantity: 1.0 },
    ];

    for (const item of nutritionEvents) {
      const eventResp = await httpJson(makeUrl(port, '/api/events'), {
        method: 'POST',
        headers: qaHeaders,
        body: JSON.stringify({
          event: 'nutrition_logged',
          screen: 'Nutrition',
          meta: {
            domain: 'nutrition',
            foodLabel: item.label,
            knownFood: item.known,
            quantity: item.quantity,
            userId: users.free,
          },
        }),
      });
      assert.equal(eventResp.response.status, 200);
      assert.equal(eventResp.data?.ok, true);
    }

    const nutritionCoachLog = await httpJson(makeUrl(port, '/api/log'), {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify({
        message: 'nutrition_feedback_signal',
        screen: 'Nutrition',
        severity: 'LOW',
        stack: JSON.stringify({ foodUnknown: true, userId: users.free }),
      }),
    });
    assert.equal(nutritionCoachLog.response.status, 200);
    assert.equal(nutritionCoachLog.data?.ok, true);

    const coachInsight = await httpJson(
      makeUrl(port, `/api/coach/insight?userId=${encodeURIComponent(users.free)}`),
      { headers: apiHeaders }
    );
    assert.equal(coachInsight.response.status, 200);
    assert.equal(typeof coachInsight.data?.message, 'string');
    assert.ok(coachInsight.data?.message.length > 0);

    const addFriend = await httpJson(makeUrl(port, '/api/social/friends/add'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ userId: users.free, friendUserId: users.friend }),
    });
    assert.equal(addFriend.response.status, 200);
    assert.equal(addFriend.data?.ok, true);

    const friendWorkout = await httpJson(makeUrl(port, '/api/workouts'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        userId: users.friend,
        name: 'friend_progress',
        mode: 'guided',
        plan: 'free',
        source: 'human-real-sim',
        totalSets: 8,
        totalVolume: 2300,
        durationMinutes: 33,
        missionsCompleted: 1,
        exercises: buildExercises('friend_progress', false),
      }),
    });
    assert.equal(friendWorkout.response.status, 200);

    const createChallenge = await httpJson(makeUrl(port, '/api/social/challenges'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        userId: users.free,
        title: 'desafio_semanal_real',
        target: 3,
        type: 'workouts_count',
      }),
    });
    assert.equal(createChallenge.response.status, 200);
    assert.equal(createChallenge.data?.ok, true);

    const challengeId = createChallenge.data?.challenge?.id;
    assert.ok(challengeId);

    const joinChallenge = await httpJson(makeUrl(port, `/api/social/challenges/${encodeURIComponent(challengeId)}/join`), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ userId: users.friend }),
    });
    assert.equal(joinChallenge.response.status, 200);

    const progressFree = await httpJson(makeUrl(port, `/api/social/challenges/${encodeURIComponent(challengeId)}/progress`), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ userId: users.free, progress: 3 }),
    });
    assert.equal(progressFree.response.status, 200);
    assert.equal(progressFree.data?.ok, true);

    const ranking = await httpJson(makeUrl(port, '/api/ranking?metric=xp'), { headers: apiHeaders });
    assert.equal(ranking.response.status, 200);
    assert.ok(Array.isArray(ranking.data));
    assert.ok(ranking.data.some((item) => item.userId === users.free));

    const socialOverview = await httpJson(
      makeUrl(port, `/api/social/overview?userId=${encodeURIComponent(users.free)}`),
      { headers: apiHeaders }
    );
    assert.equal(socialOverview.response.status, 200);
    assert.equal(socialOverview.data?.ok, true);
    assert.ok(Array.isArray(socialOverview.data?.friendsLeaderboard));

    const workoutsHistory = await httpJson(
      makeUrl(port, `/api/workouts?userId=${encodeURIComponent(users.free)}&limit=100`),
      { headers: apiHeaders }
    );
    assert.equal(workoutsHistory.response.status, 200);
    assert.ok(Array.isArray(workoutsHistory.data));
    assert.ok(workoutsHistory.data.length >= 3);

    const myStats = await httpJson(
      makeUrl(port, `/api/me/stats?userId=${encodeURIComponent(users.free)}&plan=free`),
      { headers: apiHeaders }
    );
    assert.equal(myStats.response.status, 200);
    assert.equal(myStats.data?.upgradeAvailable, true);

    const setFaults = await httpJson(makeUrl(port, '/api/test/faults'), {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify({ active: true, forceApiError: true, apiDelayMs: 0 }),
    });
    assert.equal(setFaults.response.status, 200);

    const offlineWorkoutPayload = {
      userId: users.free,
      name: 'offline_pending_workout',
      mode: 'guided',
      plan: 'free',
      source: 'offline-sim',
      totalSets: 6,
      totalVolume: 1400,
      durationMinutes: 21,
      exercises: buildExercises('offline_pending_workout', false),
    };

    const failedWorkout = await httpJson(makeUrl(port, '/api/workouts'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(offlineWorkoutPayload),
    });
    assert.equal(failedWorkout.response.status, 503);
    pendingForSync.push({ route: '/api/workouts', payload: offlineWorkoutPayload });

    const offlineHydrationPayload = {
      userId: users.free,
      ml: 500,
      timezone: 'America/Sao_Paulo',
      occurredAt: new Date().toISOString(),
    };
    const failedHydration = await httpJson(makeUrl(port, '/api/hydration'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(offlineHydrationPayload),
    });
    assert.equal(failedHydration.response.status, 503);
    pendingForSync.push({ route: '/api/hydration', payload: offlineHydrationPayload });

    const clearFaults = await httpJson(makeUrl(port, '/api/test/faults'), {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify({ active: false, forceApiError: false, apiDelayMs: 0 }),
    });
    assert.equal(clearFaults.response.status, 200);

    for (const pending of pendingForSync) {
      const replay = await httpJson(makeUrl(port, pending.route), {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(pending.payload),
      });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.data?.ok, true);
    }

    const analyzeBatch = await httpJson(makeUrl(port, '/api/analyze-batch'), {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify([
        {
          message: 'error_sync_timeout',
          screen: 'SyncScreen',
          severity: 'HIGH',
          stack: 'network timeout',
        },
        {
          message: 'ui_abandonment_after_paywall',
          screen: 'Paywall',
          severity: 'MEDIUM',
          stack: 'user_cancelled',
        },
      ]),
    });
    assert.equal(analyzeBatch.response.status, 200);
    assert.ok(Array.isArray(analyzeBatch.data));

    const insights = await httpJson(makeUrl(port, '/api/insights?limit=20'), { headers: qaHeaders });
    assert.equal(insights.response.status, 200);
    assert.ok(
      Array.isArray(insights.data?.insights)
      || Array.isArray(insights.data?.bugs)
      || insights.data?.ok === true
    );

    const learningSummary = await httpJson(makeUrl(port, '/api/learning/summary'), { headers: qaHeaders });
    assert.equal(learningSummary.response.status, 200);
    assert.ok(learningSummary.data?.ok === true || learningSummary.data?.ok === undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
