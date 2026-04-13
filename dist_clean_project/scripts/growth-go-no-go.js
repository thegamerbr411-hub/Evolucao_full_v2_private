const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts');
const EVENTS_FILE = path.join(ARTIFACTS_DIR, 'events.json');
const OUT_JSON_FILE = path.join(ARTIFACTS_DIR, 'growth-go-no-go.json');
const OUT_MD_FILE = path.join(ARTIFACTS_DIR, 'growth-exec-review.md');

const EXPERIMENTS = [
  {
    key: 'exp_workout_fast_finish_v1',
    ticket: 'T2/T3',
    name: 'CTA concluir rapido treino + instrumentacao',
    fromEvent: 'workout_started',
    toEvent: 'workout_completed',
    targetPct: 8,
  },
  {
    key: 'exp_nutrition_one_tap_close_v1',
    ticket: 'T4',
    name: 'Fechar dia com 1 toque',
    fromEvent: 'nutrition_day_saved',
    toEvent: 'nutrition_day_completed',
    targetPct: 10,
  },
  {
    key: 'exp_paywall_timing_v1',
    ticket: 'T10',
    name: 'Timing do paywall',
    fromEvent: 'paywall_open',
    toEvent: 'paywall_clicked',
    targetPct: 8,
  },
  {
    key: 'exp_paywall_copy_v1',
    ticket: 'T11',
    name: 'Copy do paywall',
    fromEvent: 'paywall_clicked',
    toEvent: 'pro_activated',
    targetPct: 8,
  },
  {
    key: 'exp_retention_antimiss_v1',
    ticket: 'T12',
    name: 'Protocolo anti-missed_day',
    fromEvent: 'retention_antimiss_prompt_viewed',
    toEvent: 'retention_antimiss_prompt_clicked',
    targetPct: 8,
  },
  {
    key: 'exp_streak_reinforcement_v1',
    ticket: 'T13',
    name: 'Reforco de streak_updated',
    fromEvent: 'streak_reinforcement_viewed',
    toEvent: 'streak_reinforcement_clicked',
    targetPct: 8,
  },
];

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(numerator, denominator) {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 0);
  if (den <= 0) {
    return 0;
  }
  return (num / den) * 100;
}

function median(values) {
  const safe = (Array.isArray(values) ? values : [])
    .map((item) => safeNumber(item, NaN))
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);

  if (!safe.length) {
    return 0;
  }

  const mid = Math.floor(safe.length / 2);
  if (safe.length % 2 === 0) {
    return (safe[mid - 1] + safe[mid]) / 2;
  }
  return safe[mid];
}

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    const tenants = raw?.tenants && typeof raw.tenants === 'object' ? raw.tenants : {};
    const allEvents = [];

    Object.entries(tenants).forEach(([tenantId, tenant]) => {
      const events = Array.isArray(tenant?.events) ? tenant.events : [];
      events.forEach((event) => {
        allEvents.push({
          tenantId,
          event: String(event?.event || ''),
          userId: String(event?.userId || 'anonymous'),
          timestampMs: safeNumber(event?.timestampMs, Date.now()),
          meta: event?.meta && typeof event.meta === 'object' ? event.meta : {},
        });
      });
    });

    return allEvents;
  } catch (_error) {
    return [];
  }
}

function getVariant(meta, experimentKey) {
  if (!meta || typeof meta !== 'object') {
    return '';
  }

  if (String(meta.experimentKey || '') === experimentKey) {
    return String(meta.variant || '').toUpperCase();
  }

  if (meta.paywallExperiment && typeof meta.paywallExperiment === 'object') {
    const key = String(meta.paywallExperiment.key || '');
    if (key === experimentKey) {
      return String(meta.paywallExperiment.variant || '').toUpperCase();
    }
  }

  if (String(meta.copyExperimentKey || '') === experimentKey) {
    return String(meta.copyVariant || '').toUpperCase();
  }

  if (String(meta.timingExperimentKey || '') === experimentKey) {
    return String(meta.timingVariant || '').toUpperCase();
  }

  return '';
}

function buildExperimentDecision(events, config) {
  const byVariant = {
    A: { from: 0, to: 0 },
    B: { from: 0, to: 0 },
  };

  events.forEach((entry) => {
    const variant = getVariant(entry.meta, config.key);
    if (variant !== 'A' && variant !== 'B') {
      return;
    }

    if (entry.event === config.fromEvent) {
      byVariant[variant].from += 1;
    }
    if (entry.event === config.toEvent) {
      byVariant[variant].to += 1;
    }
  });

  const rateA = percent(byVariant.A.to, byVariant.A.from);
  const rateB = percent(byVariant.B.to, byVariant.B.from);
  const uplift = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : (rateB > 0 ? 100 : 0);
  const samples = byVariant.A.from + byVariant.B.from;

  let decision = 'hold';
  let reason = 'Aguardando amostra minima para decisao';

  if (samples >= 40) {
    if (uplift >= config.targetPct) {
      decision = 'promote_variant_b';
      reason = `Uplift de ${uplift.toFixed(2)}% acima da meta de ${config.targetPct}%`;
    } else if (uplift <= -Math.max(5, config.targetPct / 2)) {
      decision = 'rollback_variant_b';
      reason = `Uplift de ${uplift.toFixed(2)}% abaixo do limite de seguranca`;
    } else {
      decision = 'hold';
      reason = `Uplift de ${uplift.toFixed(2)}% ainda inconclusivo`;
    }
  }

  return {
    ticket: config.ticket,
    experimentKey: config.key,
    name: config.name,
    fromEvent: config.fromEvent,
    toEvent: config.toEvent,
    targetPct: config.targetPct,
    sampleSize: samples,
    variantA: {
      from: byVariant.A.from,
      to: byVariant.A.to,
      conversionPct: Number(rateA.toFixed(2)),
    },
    variantB: {
      from: byVariant.B.from,
      to: byVariant.B.to,
      conversionPct: Number(rateB.toFixed(2)),
    },
    upliftPct: Number(uplift.toFixed(2)),
    decision,
    reason,
  };
}

function buildGuardrailChecklist(events) {
  const counters = {
    workoutSetSaved: 0,
    workoutSetSaveFailed: 0,
    quickMealSaved: 0,
    quickMealSaveFailed: 0,
    mealDraftSaved: 0,
    mealDraftSaveFailed: 0,
    missedDay: 0,
  };

  const workoutCompletionDurations = [];

  events.forEach((entry) => {
    if (entry.event === 'workout_set_saved') counters.workoutSetSaved += 1;
    if (entry.event === 'workout_set_save_failed') counters.workoutSetSaveFailed += 1;
    if (entry.event === 'quick_meal_saved') counters.quickMealSaved += 1;
    if (entry.event === 'quick_meal_save_failed') counters.quickMealSaveFailed += 1;
    if (entry.event === 'meal_draft_saved') counters.mealDraftSaved += 1;
    if (entry.event === 'meal_draft_save_failed') counters.mealDraftSaveFailed += 1;
    if (entry.event === 'missed_day') counters.missedDay += 1;

    const durationMs = safeNumber(entry?.meta?.durationMs, NaN);
    if (entry.event === 'workout_completed' && Number.isFinite(durationMs) && durationMs >= 0) {
      workoutCompletionDurations.push(durationMs);
    }
  });

  const workoutFailRate = percent(
    counters.workoutSetSaveFailed,
    counters.workoutSetSaved + counters.workoutSetSaveFailed
  );

  const nutritionFailRate = percent(
    counters.quickMealSaveFailed + counters.mealDraftSaveFailed,
    counters.quickMealSaved + counters.mealDraftSaved + counters.quickMealSaveFailed + counters.mealDraftSaveFailed
  );

  const workoutCompletionP50Ms = median(workoutCompletionDurations);

  return {
    counters,
    metrics: {
      workoutFailRatePct: Number(workoutFailRate.toFixed(2)),
      nutritionFailRatePct: Number(nutritionFailRate.toFixed(2)),
      workoutCompletionP50Ms: Number(workoutCompletionP50Ms.toFixed(0)),
    },
    status: {
      workoutSaveGuardrail: workoutFailRate <= 10,
      nutritionSaveGuardrail: nutritionFailRate <= 10,
      workoutCompletionGuardrail: workoutCompletionP50Ms <= 180000 || workoutCompletionP50Ms === 0,
      missedDayGuardrail: counters.missedDay <= 50,
    },
  };
}

function buildExecutiveSummary(decisions, guardrails) {
  const promoted = decisions.filter((item) => item.decision === 'promote_variant_b').length;
  const rollback = decisions.filter((item) => item.decision === 'rollback_variant_b').length;
  const hold = decisions.filter((item) => item.decision === 'hold').length;

  const allGuardrailsOk = Object.values(guardrails.status).every(Boolean);

  return {
    promoted,
    rollback,
    hold,
    allGuardrailsOk,
    finalRecommendation: allGuardrailsOk
      ? (rollback > 0 ? 'partial_rollback' : 'continue_with_winners')
      : 'rollback_partial_until_stable',
  };
}

function toDayKey(timestampMs) {
  const date = new Date(safeNumber(timestampMs, Date.now()));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSevenDayBaseline(events) {
  const byDay = new Map();

  events.forEach((entry) => {
    const dayKey = toDayKey(entry.timestampMs);
    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, []);
    }
    byDay.get(dayKey).push(entry);
  });

  const days = Array.from(byDay.keys()).sort((a, b) => a.localeCompare(b)).slice(-7);

  const rows = days.map((dayKey) => {
    const dayEvents = byDay.get(dayKey) || [];
    const activeUsers = new Set();
    const workoutUsers = new Set();
    const nutritionUsers = new Set();

    dayEvents.forEach((entry) => {
      activeUsers.add(entry.userId);
      if (entry.event === 'workout_completed') {
        workoutUsers.add(entry.userId);
      }
      if (entry.event === 'nutrition_day_completed') {
        nutritionUsers.add(entry.userId);
      }
    });

    const bothUsers = new Set([...workoutUsers].filter((userId) => nutritionUsers.has(userId)));
    const northStarPct = percent(bothUsers.size, activeUsers.size);

    return {
      dayKey,
      activeUsers: activeUsers.size,
      workoutCompletedUsers: workoutUsers.size,
      nutritionCompletedUsers: nutritionUsers.size,
      dualAdherenceUsers: bothUsers.size,
      northStarPct: Number(northStarPct.toFixed(2)),
    };
  });

  const avgNorthStar = rows.length
    ? rows.reduce((acc, row) => acc + safeNumber(row.northStarPct, 0), 0) / rows.length
    : 0;

  return {
    days: rows,
    summary: {
      points: rows.length,
      avgNorthStarPct: Number(avgNorthStar.toFixed(2)),
      lastDayNorthStarPct: rows.length ? rows[rows.length - 1].northStarPct : 0,
    },
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Review Executivo de Crescimento');
  lines.push('');
  lines.push(`- Gerado em: ${report.generatedAt}`);
  lines.push(`- Janela analisada: ${report.windowSummary.totalEvents} eventos`);
  lines.push(`- Recomendacao final: ${report.executive.finalRecommendation}`);
  lines.push('');
  lines.push('## Guardrails (T5)');
  lines.push(`- workout save failure rate: ${report.guardrails.metrics.workoutFailRatePct}%`);
  lines.push(`- nutrition save failure rate: ${report.guardrails.metrics.nutritionFailRatePct}%`);
  lines.push(`- workout completion p50: ${report.guardrails.metrics.workoutCompletionP50Ms} ms`);
  lines.push(`- missed_day count: ${report.guardrails.counters.missedDay}`);
  lines.push('');
  lines.push('## Baseline 7 dias (T1)');
  lines.push(`- Pontos coletados: ${report.baseline7d.summary.points}`);
  lines.push(`- North star media: ${report.baseline7d.summary.avgNorthStarPct}%`);
  lines.push(`- North star ultimo dia: ${report.baseline7d.summary.lastDayNorthStarPct}%`);
  lines.push('');
  lines.push('## Go/No-Go por experimento (T8)');
  report.decisions.forEach((item) => {
    lines.push(`- ${item.ticket} (${item.experimentKey}): ${item.decision} | sample=${item.sampleSize} | uplift=${item.upliftPct}% | motivo=${item.reason}`);
  });
  lines.push('');
  lines.push('## Consolidacao (T14)');
  lines.push(`- Promover: ${report.executive.promoted}`);
  lines.push(`- Rollback parcial: ${report.executive.rollback}`);
  lines.push(`- Manter em coleta: ${report.executive.hold}`);
  lines.push(`- Guardrails ok: ${report.executive.allGuardrailsOk}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  ensureArtifactsDir();
  const events = readEvents();

  const decisions = EXPERIMENTS.map((config) => buildExperimentDecision(events, config));
  const guardrails = buildGuardrailChecklist(events);
  const baseline7d = buildSevenDayBaseline(events);
  const executive = buildExecutiveSummary(decisions, guardrails);

  const report = {
    generatedAt: new Date().toISOString(),
    windowSummary: {
      totalEvents: events.length,
      tenants: Array.from(new Set(events.map((item) => item.tenantId))).length,
    },
    guardrails,
    baseline7d,
    decisions,
    executive,
  };

  fs.writeFileSync(OUT_JSON_FILE, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(OUT_MD_FILE, toMarkdown(report), 'utf-8');

  console.log(`[growth-review] ok events=${events.length} decisions=${decisions.length}`);
  console.log(`[growth-review] json=${OUT_JSON_FILE}`);
  console.log(`[growth-review] md=${OUT_MD_FILE}`);
}

main();
