const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startServer } = require('../server');

function signAppUserToken(payload = {}) {
  return jwt.sign(
    {
      id: 'user_qa_1',
      role: 'user',
      isAdmin: false,
      ...payload,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

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
  return { payload, response };
}

async function run() {
  process.env.ADMIN_USER = 'admin';
  process.env.ADMIN_PASS = 'pass123';
  process.env.JWT_SECRET = 'test-secret';
  process.env.CLIENT_API_KEYS = JSON.stringify({ admin: '123456' });
  process.env.APP_API_KEY = 'app-key-test';
  process.env.ENABLE_QA_LOCAL_BYPASS = '1';
  const qaClientId = `night-qa-${Date.now()}`;

  const server = startServer(0);
  const port = server.address().port;

  try {
    const login = await httpJson(buildUrl(port, '/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', pass: 'pass123' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.ok, true);
    assert.ok(login.payload.token);

    const log = await httpJson(buildUrl(port, '/api/log'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'content-type': 'application/json',
        'x-api-key': '123456',
      },
      body: JSON.stringify({
        message: 'Network error 500',
        screen: 'Home',
        stack: 'Error: fail\nat node_modules/x.js\nat Home.js:20',
        synthetic: true,
        syntheticTag: 'dashboard_api_test',
        syntheticReason: 'qa_error_pipeline_validation',
      }),
    });
    assert.equal(log.response.status, 200);
    assert.equal(log.payload.ok, true);

    const event = await httpJson(buildUrl(port, '/api/events'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
      body: JSON.stringify({
        event: 'tap',
        meta: {
          domain: 'navigation',
          id: 'tab-treino',
        },
        screen: 'MainTabs',
      }),
    });
    assert.equal(event.response.status, 200);
    assert.equal(event.payload.ok, true);

    const heatmap = await httpJson(buildUrl(port, '/api/heatmap'), {
      headers: {
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
    });
    assert.equal(heatmap.response.status, 200);
    assert.equal(typeof heatmap.payload, 'object');

    const applyFix = await httpJson(buildUrl(port, '/api/apply-fix'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
      body: JSON.stringify({
        file: 'src/screens/HomeScreen.js',
        change: 'Adicionar loading state no CTA principal',
      }),
    });
    assert.equal(applyFix.response.status, 200);
    assert.equal(applyFix.payload.ok, true);

    const bugs = await httpJson(buildUrl(port, '/api/bugs?limit=5'), {
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'x-api-key': '123456',
      },
    });
    assert.equal(bugs.response.status, 200);
    assert.ok(Array.isArray(bugs.payload));
    assert.ok(bugs.payload.length >= 1);
    assert.equal(bugs.payload[0].severity, 'HIGH');
    assert.equal(String(bugs.payload[0].stack || '').includes('node_modules'), false);

    const batch = await httpJson(buildUrl(port, '/api/analyze-batch'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'content-type': 'application/json',
        'x-api-key': '123456',
      },
      body: JSON.stringify([{ message: 'axios undefined network' }]),
    });
    assert.equal(batch.response.status, 200);
    assert.ok(Array.isArray(batch.payload));
    assert.equal(batch.payload[0].suggestion, 'Instale axios ou verifique import');

    const clientToken = await httpJson(buildUrl(port, '/token/client'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'admin' }),
    });
    assert.equal(clientToken.response.status, 200);
    assert.ok(clientToken.payload.token);

    const insights = await httpJson(buildUrl(port, '/api/insights?limit=5'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(insights.response.status, 200);
    assert.equal(insights.payload.clientId, 'admin');
    assert.ok(Array.isArray(insights.payload.insights));
    if (insights.payload.insights.length) {
      assert.ok(insights.payload.insights[0].priorityLabel);
    }

    const retests = await httpJson(buildUrl(port, '/api/retests?limit=5'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(retests.response.status, 200);
    assert.ok(Array.isArray(retests.payload.history));

    const targetBug = Array.isArray(bugs.payload) && bugs.payload.length ? bugs.payload[0] : null;
    assert.ok(targetBug);

    const staleDecision = await httpJson(buildUrl(port, '/api/bug-decision'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fingerprint: targetBug.fingerprint,
        decision: 'resolver',
        expectedStatus: 'inexistente',
        expectedCount: Number(targetBug.count || 0),
      }),
    });
    assert.equal(staleDecision.response.status, 409);
    assert.equal(staleDecision.payload.error, 'stale_bug_state');

    const artifacts = await httpJson(buildUrl(port, '/api/maintenance/artifacts?limit=10'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(artifacts.response.status, 200);
    assert.equal(artifacts.payload.ok, true);
    assert.ok(Array.isArray(artifacts.payload.folders));
    assert.equal(typeof artifacts.payload.total, 'number');

    const cleanup = await httpJson(buildUrl(port, '/api/maintenance/cleanup'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        retentionDays: 0,
        keepLatestDetox: 3,
      }),
    });
    assert.equal(cleanup.response.status, 200);
    assert.equal(cleanup.payload.ok, true);
    assert.equal(typeof cleanup.payload.bugs, 'object');
    assert.equal(typeof cleanup.payload.detox, 'object');
    assert.ok(cleanup.payload.timestamp);

    const workoutPayload = {
      userId: 'user_qa_1',
      name: 'Treino teste API',
      plan: 'free',
      totalSets: 3,
      totalVolume: 1200,
      exercises: [
        { name: 'supino', reps: 10, sets: 3, weight: 40 },
      ],
    };

    const saveWorkout = await httpJson(buildUrl(port, '/api/workouts'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
        'x-user-id': 'user_qa_1',
      },
      body: JSON.stringify(workoutPayload),
    });
    assert.equal(saveWorkout.response.status, 200);
    assert.equal(saveWorkout.payload.ok, true);
    assert.equal(saveWorkout.payload.workout.userId, 'user_qa_1');

    const rejectWorkoutWithoutUser = await httpJson(buildUrl(port, '/api/workouts'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
        'x-user-id': 'forged_user_id',
      },
      body: JSON.stringify({
        ...workoutPayload,
        userId: '',
      }),
    });
    assert.equal(rejectWorkoutWithoutUser.response.status, 400);
    assert.equal(rejectWorkoutWithoutUser.payload.error, 'missing_user_id');

    const saveHydration = await httpJson(buildUrl(port, '/api/hydration'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
        'x-user-timezone': 'America/Sao_Paulo',
      },
      body: JSON.stringify({
        id: 'hydration-e2e-1',
        userId: 'user_qa_1',
        ml: 350,
        occurredAt: '2026-04-11T12:00:00.000Z',
      }),
    });
    assert.equal(saveHydration.response.status, 200);
    assert.equal(saveHydration.payload.ok, true);
    assert.equal(Number(saveHydration.payload.entry?.ml || 0) >= 350, true);
    assert.equal(typeof saveHydration.payload.deduped, 'boolean');

    const hydrationSummary = await httpJson(buildUrl(port, '/api/hydration?userId=user_qa_1&dayKey=2026-04-11'), {
      headers: {
        'x-api-key': 'app-key-test',
        'x-user-timezone': 'America/Sao_Paulo',
      },
    });
    assert.equal(hydrationSummary.response.status, 200);
    assert.equal(hydrationSummary.payload.ok, true);
    assert.equal(typeof hydrationSummary.payload.summary.totalMl, 'number');
    assert.equal(Number(hydrationSummary.payload.summary.totalMl) >= 350, true);

    const listWorkouts = await httpJson(buildUrl(port, '/api/workouts?userId=user_qa_1'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(listWorkouts.response.status, 200);
    assert.ok(Array.isArray(listWorkouts.payload));
    assert.ok(listWorkouts.payload.length >= 1);

    const streak = await httpJson(buildUrl(port, '/api/streak?userId=user_qa_1'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(streak.response.status, 200);
    assert.equal(typeof streak.payload.streakDays, 'number');

    const ranking = await httpJson(buildUrl(port, '/api/ranking'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(ranking.response.status, 200);
    assert.ok(Array.isArray(ranking.payload));

    const rankingXp = await httpJson(buildUrl(port, '/api/ranking?metric=xp'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(rankingXp.response.status, 200);
    assert.ok(Array.isArray(rankingXp.payload));
    if (rankingXp.payload.length) {
      assert.equal(typeof rankingXp.payload[0].xpScore, 'number');
      assert.equal(typeof rankingXp.payload[0].league, 'string');
      assert.equal(typeof rankingXp.payload[0].nextLeagueProgress, 'number');
    }

    const rankingCompleted = await httpJson(buildUrl(port, '/api/ranking?metric=completed'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(rankingCompleted.response.status, 200);
    assert.ok(Array.isArray(rankingCompleted.payload));
    if (rankingCompleted.payload.length) {
      assert.equal(typeof rankingCompleted.payload[0].completedScore, 'number');
    }

    const rankingMicro = await httpJson(buildUrl(port, '/api/ranking/micro?metric=xp&userId=user_qa_1&radius=2'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(rankingMicro.response.status, 200);
    assert.equal(rankingMicro.payload.ok, true);
    assert.equal(rankingMicro.payload.userId, 'user_qa_1');
    assert.ok(Array.isArray(rankingMicro.payload.ranking));

    const xpFormula = await httpJson(buildUrl(port, '/api/gamification/formula'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(xpFormula.response.status, 200);
    assert.equal(xpFormula.payload.ok, true);
    assert.equal(typeof xpFormula.payload.formula, 'object');
    assert.equal(typeof xpFormula.payload.formula.rules, 'object');

    const meStats = await httpJson(buildUrl(port, '/api/me/stats?userId=user_qa_1&plan=free'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(meStats.response.status, 200);
    assert.equal(meStats.payload.userId, 'user_qa_1');
    assert.equal(typeof meStats.payload.totalWorkouts, 'number');
    assert.ok(Array.isArray(meStats.payload.exerciseProgress));
    assert.equal(typeof meStats.payload.xp, 'number');
    assert.equal(typeof meStats.payload.level, 'number');
    assert.equal(typeof meStats.payload.league, 'string');
    assert.equal(typeof meStats.payload.rankings, 'object');

    const addFriend = await httpJson(buildUrl(port, '/api/social/friends/add'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({ userId: 'user_qa_1', friendUserId: 'user_qa_2' }),
    });
    assert.equal(addFriend.response.status, 200);
    assert.equal(addFriend.payload.ok, true);
    if (addFriend.payload.alreadyAdded) {
      assert.equal(addFriend.payload.alreadyAdded, true);
    } else {
      assert.ok(Array.isArray(addFriend.payload.friends));
    }

    const createChallengeDenied = await httpJson(buildUrl(port, '/api/social/challenges'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({
        userId: 'user_qa_1',
        title: 'Desafio 3 treinos',
        target: 3,
        type: 'workouts_count',
      }),
    });
    assert.equal(createChallengeDenied.response.status, 401);

    const createChallengeForbidden = await httpJson(buildUrl(port, '/api/social/challenges'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${signAppUserToken({ id: 'user_qa_1', role: 'user', isAdmin: false })}`,
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({
        userId: 'user_qa_1',
        title: 'Desafio 3 treinos',
        target: 3,
        type: 'workouts_count',
      }),
    });
    assert.equal(createChallengeForbidden.response.status, 403);
    assert.equal(createChallengeForbidden.payload.error, 'admin_required');

    const createChallenge = await httpJson(buildUrl(port, '/api/social/challenges'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${signAppUserToken({ id: 'user_qa_1', role: 'admin', isAdmin: true })}`,
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({
        userId: 'user_qa_1',
        title: 'Desafio 3 treinos',
        target: 3,
        type: 'workouts_count',
      }),
    });
    assert.equal(createChallenge.response.status, 200);
    assert.equal(createChallenge.payload.ok, true);
    assert.ok(createChallenge.payload.challenge?.id);

    const invalidChallenge = await httpJson(buildUrl(port, '/api/social/challenges'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${signAppUserToken({ id: 'user_qa_1', role: 'admin', isAdmin: true })}`,
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({
        userId: 'user_qa_1',
        title: '   ',
        target: 3,
      }),
    });
    assert.equal(invalidChallenge.response.status, 400);

    const challengeId = createChallenge.payload.challenge.id;
    const joinChallenge = await httpJson(buildUrl(port, `/api/social/challenges/${encodeURIComponent(challengeId)}/join`), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({ userId: 'user_qa_2' }),
    });
    assert.equal(joinChallenge.response.status, 200);
    assert.equal(joinChallenge.payload.ok, true);

    const challengeProgress = await httpJson(buildUrl(port, `/api/social/challenges/${encodeURIComponent(challengeId)}/progress`), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'app-key-test',
      },
      body: JSON.stringify({ userId: 'user_qa_1', progress: 2 }),
    });
    assert.equal(challengeProgress.response.status, 200);
    assert.equal(challengeProgress.payload.ok, true);

    const socialOverview = await httpJson(buildUrl(port, '/api/social/overview?userId=user_qa_1'), {
      headers: {
        'x-api-key': 'app-key-test',
      },
    });
    assert.equal(socialOverview.response.status, 200);
    assert.equal(socialOverview.payload.ok, true);
    assert.ok(Array.isArray(socialOverview.payload.friends));
    assert.ok(Array.isArray(socialOverview.payload.activeChallenges));
    assert.ok(Array.isArray(socialOverview.payload.friendsLeaderboard));
    assert.ok(Array.isArray(socialOverview.payload.consistencyLeaderboard));
    assert.ok(Array.isArray(socialOverview.payload.volumeLeaderboard));
    assert.ok(Array.isArray(socialOverview.payload.completedLeaderboard));
    assert.equal(typeof socialOverview.payload.xpToPassFriend, 'number');

    console.log('api-test:ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error('api-test:fail', error.message);
  process.exit(1);
});
