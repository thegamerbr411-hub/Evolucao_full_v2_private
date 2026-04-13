import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../dashboard/server.js';

function buildUrl(port, route) {
  return `http://127.0.0.1:${port}${route}`;
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { response, payload };
}

test('fluxo real variado: treino, ranking, social e desafio concluido', async () => {
  process.env.ADMIN_USER = 'admin';
  process.env.ADMIN_PASS = 'pass123';
  process.env.JWT_SECRET = 'test-secret';
  process.env.CLIENT_API_KEYS = JSON.stringify({ admin: '123456' });
  process.env.APP_API_KEY = 'app-key-test';
  process.env.ENABLE_QA_LOCAL_BYPASS = '1';

  const server = startServer(0);
  const port = server.address().port;

  const apiHeaders = {
    'content-type': 'application/json',
    'x-api-key': 'app-key-test',
  };

  const saveWorkout = (payload) => httpJson(buildUrl(port, '/api/workouts'), {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(payload),
  });

  try {
    const userA = 'ux_user_a';
    const userB = 'ux_user_b';

    const scenarios = [
      { name: 'treino completo descanso normal', totalSets: 12, totalVolume: 4200, durationMinutes: 52, missionsCompleted: 2 },
      { name: 'treino completo descanso curto', totalSets: 11, totalVolume: 3900, durationMinutes: 38, missionsCompleted: 1 },
      { name: 'treino sem descanso entre exercicios', totalSets: 10, totalVolume: 3600, durationMinutes: 30, missionsCompleted: 1 },
      { name: 'abandono parcial', totalSets: 4, totalVolume: 900, durationMinutes: 14, missionsCompleted: 0 },
      { name: 'treino diferente da rodada anterior', totalSets: 9, totalVolume: 3400, durationMinutes: 41, missionsCompleted: 2 },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const result = await saveWorkout({
        userId: userA,
        name: scenario.name,
        mode: 'guided',
        plan: 'free',
        totalSets: scenario.totalSets,
        totalVolume: scenario.totalVolume,
        durationMinutes: scenario.durationMinutes,
        missionsCompleted: scenario.missionsCompleted,
        createdAt: new Date(Date.now() - (scenarios.length - index) * 12 * 60 * 60 * 1000).toISOString(),
        exercises: [
          { name: 'supino', reps: 10, sets: 3, weight: 40 },
          { name: 'remada', reps: 10, sets: 3, weight: 45 },
        ],
      });
      assert.equal(result.response.status, 200);
      assert.equal(result.payload.ok, true);
    }

    const userBWorkout = await saveWorkout({
      userId: userB,
      name: 'treino base user b',
      mode: 'guided',
      plan: 'free',
      totalSets: 6,
      totalVolume: 1600,
      durationMinutes: 24,
      missionsCompleted: 1,
      exercises: [{ name: 'agachamento', reps: 8, sets: 3, weight: 60 }],
    });
    assert.equal(userBWorkout.response.status, 200);

    const rankingXp = await httpJson(buildUrl(port, '/api/ranking?metric=xp'), {
      headers: { 'x-api-key': 'app-key-test' },
    });
    assert.equal(rankingXp.response.status, 200);
    assert.ok(Array.isArray(rankingXp.payload));
    assert.ok(rankingXp.payload.some((item) => item.userId === userA));

    const meStatsA = await httpJson(buildUrl(port, `/api/me/stats?userId=${encodeURIComponent(userA)}&plan=free`), {
      headers: { 'x-api-key': 'app-key-test' },
    });
    assert.equal(meStatsA.response.status, 200);
    assert.equal(typeof meStatsA.payload.xp, 'number');
    assert.equal(typeof meStatsA.payload.level, 'number');
    assert.ok(Array.isArray(meStatsA.payload.badges));

    const addFriend = await httpJson(buildUrl(port, '/api/social/friends/add'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ userId: userA, friendUserId: userB }),
    });
    assert.equal(addFriend.response.status, 200);
    assert.equal(addFriend.payload.ok, true);

    const createChallenge = await httpJson(buildUrl(port, '/api/social/challenges'), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        userId: userA,
        title: 'Desafio UX variado',
        target: 3,
        type: 'workouts_count',
      }),
    });
    assert.equal(createChallenge.response.status, 200);
    assert.equal(createChallenge.payload.ok, true);

    const challengeId = createChallenge.payload.challenge.id;

    const joinChallenge = await httpJson(buildUrl(port, `/api/social/challenges/${encodeURIComponent(challengeId)}/join`), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ userId: userB }),
    });
    assert.equal(joinChallenge.response.status, 200);

    const progressA = await httpJson(buildUrl(port, `/api/social/challenges/${encodeURIComponent(challengeId)}/progress`), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ userId: userA, progress: 3 }),
    });
    assert.equal(progressA.response.status, 200);
    assert.equal(progressA.payload.ok, true);
    assert.equal(String(progressA.payload.challenge.status), 'completed');
    assert.equal(String(progressA.payload.challenge.winner.userId), userA);

    const socialOverview = await httpJson(buildUrl(port, `/api/social/overview?userId=${encodeURIComponent(userA)}`), {
      headers: { 'x-api-key': 'app-key-test' },
    });
    assert.equal(socialOverview.response.status, 200);
    assert.equal(socialOverview.payload.ok, true);
    assert.ok(Array.isArray(socialOverview.payload.friends));
    assert.ok(Array.isArray(socialOverview.payload.friendsLeaderboard));
    assert.ok(Array.isArray(socialOverview.payload.completedLeaderboard));
    assert.equal(typeof socialOverview.payload.xpToPassFriend, 'number');

    const eventWater = await httpJson(buildUrl(port, '/api/events'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qa-client-id': `ux-${Date.now()}`,
        'x-qa-local': '1',
      },
      body: JSON.stringify({
        event: 'water_logged',
        screen: 'Nutricao',
        meta: { amountMl: 300, domain: 'nutrition' },
      }),
    });
    assert.equal(eventWater.response.status, 200);
    assert.equal(eventWater.payload.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
