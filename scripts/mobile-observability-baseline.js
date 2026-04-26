const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = path.join(ROOT, 'artifacts');
const QA_DIR = path.join(ROOT, 'qa');
const EVENTS_FILE = path.join(ARTIFACTS, 'events.json');
const OUT_JSON = path.join(QA_DIR, 'mobile-observability-baseline.json');
const OUT_MD = path.join(QA_DIR, 'MOBILE_OBSERVABILITY_BASELINE.md');

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return (numerator / denominator) * 100;
}

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    return [];
  }

  try {
    const payload = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    const tenants = payload?.tenants && typeof payload.tenants === 'object' ? payload.tenants : {};
    const all = [];

    Object.entries(tenants).forEach(([tenantId, tenant]) => {
      const events = Array.isArray(tenant?.events) ? tenant.events : [];
      events.forEach((event) => {
        all.push({
          tenantId,
          event: String(event?.event || ''),
          userId: String(event?.userId || 'anonymous'),
          timestampMs: safeNumber(event?.timestampMs, Date.now()),
          meta: event?.meta && typeof event.meta === 'object' ? event.meta : {},
        });
      });
    });

    return all;
  } catch {
    return [];
  }
}

function isErrorEvent(name) {
  const value = String(name || '').toLowerCase();
  return value.includes('error') || value.endsWith('_failed') || value.includes('fail');
}

function isCriticalEvent(name, meta) {
  const value = String(name || '').toLowerCase();
  if (String(meta?.severity || '').toLowerCase() === 'critical') {
    return true;
  }
  return value.includes('critical') || value.includes('fatal') || value.includes('crash');
}

function buildBaseline(events) {
  const users = new Map();
  let errorEvents = 0;
  let criticalEvents = 0;

  for (const entry of events) {
    const userKey = `${entry.tenantId}:${entry.userId}`;
    if (!users.has(userKey)) {
      users.set(userKey, { total: 0, error: 0, critical: 0 });
    }

    const bucket = users.get(userKey);
    bucket.total += 1;

    if (isErrorEvent(entry.event)) {
      bucket.error += 1;
      errorEvents += 1;
    }

    if (isCriticalEvent(entry.event, entry.meta)) {
      bucket.critical += 1;
      criticalEvents += 1;
    }
  }

  const sessionCount = users.size;
  const sessionsWithError = Array.from(users.values()).filter((item) => item.error > 0).length;
  const sessionsWithCritical = Array.from(users.values()).filter((item) => item.critical > 0).length;

  const totalEvents = events.length;
  const errorRatePerSessionPct = Number(pct(sessionsWithError, sessionCount).toFixed(2));
  const criticalRatePerSessionPct = Number(pct(sessionsWithCritical, sessionCount).toFixed(2));
  const errorRatePerEventPct = Number(pct(errorEvents, totalEvents).toFixed(2));

  const slo = {
    targetErrorSessionRatePct: safeNumber(process.env.MOBILE_SLO_ERROR_SESSION_PCT, 5),
    targetCriticalSessionRatePct: safeNumber(process.env.MOBILE_SLO_CRITICAL_SESSION_PCT, 1),
    targetErrorEventRatePct: safeNumber(process.env.MOBILE_SLO_ERROR_EVENT_PCT, 2),
  };

  const breaches = [];
  if (errorRatePerSessionPct > slo.targetErrorSessionRatePct) {
    breaches.push(`error_session_rate_exceeded:${errorRatePerSessionPct}>${slo.targetErrorSessionRatePct}`);
  }
  if (criticalRatePerSessionPct > slo.targetCriticalSessionRatePct) {
    breaches.push(`critical_session_rate_exceeded:${criticalRatePerSessionPct}>${slo.targetCriticalSessionRatePct}`);
  }
  if (errorRatePerEventPct > slo.targetErrorEventRatePct) {
    breaches.push(`error_event_rate_exceeded:${errorRatePerEventPct}>${slo.targetErrorEventRatePct}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(ROOT, EVENTS_FILE).replace(/\\/g, '/'),
    totals: {
      events: totalEvents,
      sessions: sessionCount,
      errorEvents,
      criticalEvents,
      sessionsWithError,
      sessionsWithCritical,
    },
    rates: {
      errorRatePerSessionPct,
      criticalRatePerSessionPct,
      errorRatePerEventPct,
    },
    slo,
    errorBudget: {
      status: breaches.length ? 'breached' : 'ok',
      breaches,
      rollbackRecommended: breaches.length > 0,
    },
  };
}

function writeOutputs(payload) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf-8');

  const lines = [
    '# Mobile Observability Baseline',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    '## Totais',
    `- Events: ${payload.totals.events}`,
    `- Sessions: ${payload.totals.sessions}`,
    `- Error events: ${payload.totals.errorEvents}`,
    `- Critical events: ${payload.totals.criticalEvents}`,
    '',
    '## Taxas',
    `- Error/session (%): ${payload.rates.errorRatePerSessionPct}`,
    `- Critical/session (%): ${payload.rates.criticalRatePerSessionPct}`,
    `- Error/event (%): ${payload.rates.errorRatePerEventPct}`,
    '',
    '## SLO',
    `- Target error/session (%): ${payload.slo.targetErrorSessionRatePct}`,
    `- Target critical/session (%): ${payload.slo.targetCriticalSessionRatePct}`,
    `- Target error/event (%): ${payload.slo.targetErrorEventRatePct}`,
    '',
    '## Error budget',
    `- Status: ${payload.errorBudget.status}`,
    `- Rollback recommended: ${payload.errorBudget.rollbackRecommended}`,
    `- Breaches: ${payload.errorBudget.breaches.join('; ') || 'none'}`,
    '',
    '## Artefatos',
    '- qa/mobile-observability-baseline.json',
    '- qa/MOBILE_OBSERVABILITY_BASELINE.md',
  ];

  fs.writeFileSync(OUT_MD, lines.join('\n'), 'utf-8');
}

function main() {
  const events = readEvents();
  const baseline = buildBaseline(events);
  writeOutputs(baseline);

  console.log('[mobile-observability] generated', path.relative(ROOT, OUT_JSON).replace(/\\/g, '/'));
  console.log('[mobile-observability] budget', baseline.errorBudget.status);

  if (String(process.env.MOBILE_SLO_ENFORCE || '0').trim() === '1' && baseline.errorBudget.rollbackRecommended) {
    process.exit(2);
  }
}

main();
