const { randomUUID } = require('crypto');

function argValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const BASE_URL = String(argValue('--base-url') || process.env.QA_BASE_URL || 'http://127.0.0.1:3000').trim();
const APP_API_KEY = String(argValue('--api-key') || process.env.APP_API_KEY || 'app-key-test').trim();
const DURATION_MS = Math.max(60_000, Number(argValue('--duration-ms') || process.env.UX_STRESS_DURATION_MS || 60 * 60 * 1000));
const STEP_DELAY_MS = Math.max(500, Number(argValue('--step-delay-ms') || process.env.UX_STRESS_STEP_DELAY_MS || 1500));

const USERS = ['stress_user_a', 'stress_user_b', 'stress_user_c'];
const SCENARIOS = [
  { label: 'descanso_curto', totalSets: 11, totalVolume: 3600, durationMinutes: 34, missionsCompleted: 1 },
  { label: 'sem_descanso', totalSets: 9, totalVolume: 3200, durationMinutes: 27, missionsCompleted: 1 },
  { label: 'treino_completo', totalSets: 14, totalVolume: 4700, durationMinutes: 56, missionsCompleted: 2 },
  { label: 'abandono_parcial', totalSets: 4, totalVolume: 900, durationMinutes: 13, missionsCompleted: 0 },
  { label: 'treino_variado', totalSets: 10, totalVolume: 3400, durationMinutes: 41, missionsCompleted: 2 },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(route, payload, headers = {}) {
  const response = await fetch(`${BASE_URL}${route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

async function getJson(route, headers = {}) {
  const response = await fetch(`${BASE_URL}${route}`, { headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

function buildWorkout(userId, scenario) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    userId,
    name: `stress_${scenario.label}`,
    mode: 'guided',
    source: 'stress-runner',
    plan: 'free',
    totalSets: scenario.totalSets,
    totalVolume: scenario.totalVolume,
    durationMinutes: scenario.durationMinutes,
    missionsCompleted: scenario.missionsCompleted,
    exercises: [
      { name: 'supino', reps: 10, sets: 3, weight: 40 },
      { name: 'agachamento', reps: 8, sets: 3, weight: 60 },
      { name: 'remada', reps: 10, sets: 3, weight: 42 },
    ],
  };
}

async function runStep(index) {
  const userId = USERS[index % USERS.length];
  const scenario = SCENARIOS[index % SCENARIOS.length];

  const workoutResult = await postJson('/api/workouts', buildWorkout(userId, scenario), {
    'x-api-key': APP_API_KEY,
  });

  if (!workoutResult.ok) {
    await postJson('/api/log', {
      message: `stress_workout_failed:${scenario.label}`,
      severity: 'HIGH',
      screen: 'Workout',
      stack: JSON.stringify({ status: workoutResult.status, data: workoutResult.data }),
      fingerprint: `stress-${scenario.label}`,
    }, {
      'x-qa-client-id': `stress-${userId}`,
      'x-qa-local': '1',
    });
    return { ok: false, type: 'workout', userId, scenario: scenario.label };
  }

  const eventResult = await postJson('/api/events', {
    event: 'ux_step',
    screen: 'StressLoop',
    meta: {
      allowBurst: true,
      domain: 'stress',
      scenario: scenario.label,
      step: index,
      userId,
    },
  }, {
    'x-qa-client-id': `stress-${userId}`,
    'x-qa-local': '1',
  });

  const ranking = await getJson('/api/ranking?metric=xp', {
    'x-api-key': APP_API_KEY,
  });

  if (!eventResult.ok || !ranking.ok) {
    await postJson('/api/log', {
      message: 'stress_event_or_ranking_failed',
      severity: 'MEDIUM',
      screen: 'SocialChallenges',
      stack: JSON.stringify({ eventStatus: eventResult.status, rankingStatus: ranking.status }),
      fingerprint: 'stress-event-ranking',
    }, {
      'x-qa-client-id': `stress-${userId}`,
      'x-qa-local': '1',
    });
    return { ok: false, type: 'post-check', userId, scenario: scenario.label };
  }

  return { ok: true, userId, scenario: scenario.label };
}

async function main() {
  const startedAt = Date.now();
  const deadline = startedAt + DURATION_MS;
  let step = 0;
  let failures = 0;

  console.log(`[ux-stress] start base=${BASE_URL} durationMs=${DURATION_MS}`);

  while (Date.now() < deadline) {
    const result = await runStep(step);
    if (!result.ok) {
      failures += 1;
      console.warn('[ux-stress] fail', result);
    } else {
      console.log('[ux-stress] ok', result.userId, result.scenario, `step=${step}`);
    }

    step += 1;
    await wait(STEP_DELAY_MS);
  }

  const summary = {
    endedAt: new Date().toISOString(),
    failures,
    runId: randomUUID(),
    startedAt: new Date(startedAt).toISOString(),
    steps: step,
  };

  console.log('[ux-stress] done', summary);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[ux-stress] fatal', error.message);
  process.exit(1);
});
