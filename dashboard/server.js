const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { analyzeBatch, analyzeBug, buildInsightsPayload } = require('./src/server/analysis');
const { createAuth } = require('./src/server/auth');
const { createTTLCache } = require('./src/server/cache');
const { normalizeIncomingLog } = require('./src/server/logs');
const { createSlidingWindowLimiter } = require('./src/server/rateLimit');
const { createRetestService } = require('./src/server/retest');
const { buildLearningSummary, listLearningEvents, recordLearningEvent } = require('./src/server/learning');
const { getQueueSystem } = require('./src/server/queue');
const {
  appendEvent,
  buildHeatmap,
  cleanupResolvedBugs,
  listArtifactFolders,
  listEvents,
  listTopBugs,
  normalizeClientId,
  pruneDetoxArtifacts,
  recordAppliedFix,
  upsertBug,
} = require('./src/server/storage');

const PORT = Number(process.env.PORT || 3000);
const BUGS_CACHE_TTL_MS = Number(process.env.BUGS_CACHE_TTL_MS || 5000);
const faultProfile = {
  active: false,
  apiDelayMs: 0,
  forceApiError: false,
};

function createApp() {
  const app = express();
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const devLocalBaseUrl = `http://127.0.0.1:${PORT}`;
  const baseUrl = String(process.env.PUBLIC_API_BASE_URL || process.env.RENDER_EXTERNAL_URL || (isProduction ? '' : devLocalBaseUrl)).trim();
  const queueSystem = getQueueSystem();
  const auth = createAuth({
    adminPass: process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD,
    adminUser: process.env.ADMIN_USER || process.env.ADMIN_EMAIL,
    allowQaLocalBypass: process.env.ENABLE_QA_LOCAL_BYPASS,
    clientKeyMap: process.env.CLIENT_API_KEYS,
    defaultClientId: process.env.DEFAULT_CLIENT_ID || 'default',
    qaLocalSecret: process.env.QA_LOCAL_SECRET,
    secret: process.env.JWT_SECRET,
  });
  const bugsCache = createTTLCache(BUGS_CACHE_TTL_MS);
  const retestService = createRetestService({ baseUrl });
  const allowedOrigins = String(process.env.CORS_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);

  app.disable('x-powered-by');
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!isProduction) {
        return callback(null, true);
      }

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('cors_origin_blocked'));
    },
  }));
  app.use(express.json({ limit: '128kb' }));

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    const start = Date.now();
    const requestId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log('[request]', JSON.stringify({
        durationMs: duration,
        method: req.method,
        path: req.path,
        requestId,
        statusCode: res.statusCode,
      }));
    });
    next();
  });

  app.use('/api', async (req, res, next) => {
    if (req.path.startsWith('/test/faults')) {
      return next();
    }

    if (faultProfile.active && Number(faultProfile.apiDelayMs || 0) > 0) {
      await new Promise((resolve) => setTimeout(resolve, Number(faultProfile.apiDelayMs)));
    }

    if (faultProfile.active && faultProfile.forceApiError) {
      return res.status(503).json({
        ok: false,
        error: 'simulated_backend_error',
        faultProfile,
      });
    }

    return next();
  });

  function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
  }

  const apiLimiter = createSlidingWindowLimiter({
    getKey: (req) => {
      const clientRef = normalizeClientId(
        req.clientId
        || req.headers['x-qa-client-id']
        || req.headers['x-api-key']
        || req.ip
        || 'unknown'
      );
      return `${clientRef}:${req.path}`;
    },
    max: Number(process.env.RATE_LIMIT_MAX || 180),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  });
  app.use('/api', apiLimiter);

  app.get('/health', asyncRoute(async (_req, res) => {
    const queueHealth = await queueSystem.getHealth();
    res.json({
      ok: true,
      queue: queueHealth.enabled ? queueHealth.queue : 'disabled',
      redis: queueHealth.redis,
      service: 'qa-dashboard-local',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  }));

  app.get('/ready', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/login', auth.handleLogin);
  app.post('/token/client', auth.authenticateAdmin, auth.handleClientToken);

  app.post('/api/log', auth.validateJWT, auth.validateClient, asyncRoute(async (req, res) => {
    const normalized = normalizeIncomingLog(req.body || {});
    const clientId = normalizeClientId(req.clientId || 'default');
    const bug = await upsertBug(clientId, normalized);

    bugsCache.clear(`bugs:${clientId}:`);

    if (Number(bug?.count || 0) > 10 && bug?.severity === 'HIGH') {
      console.log('[alert]', JSON.stringify({
        clientId,
        count: bug.count,
        message: bug.message,
        severity: bug.severity,
      }));
    }

    recordLearningEvent(clientId, {
      action: 'api_log',
      error: normalized.message,
      eventType: 'error_log',
      meta: {
        fingerprint: bug?.fingerprint || normalized.fingerprint || '',
        severity: normalized.severity,
      },
      screen: normalized.screen,
    });

    await queueSystem.enqueue('bugQueue', {
      bug,
      clientId,
      fingerprint: bug?.fingerprint || normalized.fingerprint,
      source: 'api_log',
    }, {
      dedupeKey: `${clientId}:${bug?.fingerprint || normalized.fingerprint || ''}`,
      jobName: 'ingest-bug',
    });

    await queueSystem.enqueue('aiQueue', {
      clientId,
      fingerprint: bug?.fingerprint || normalized.fingerprint,
      source: 'api_log',
    }, {
      dedupeKey: `${clientId}:${bug?.fingerprint || normalized.fingerprint || ''}`,
      jobName: 'analyze-bug',
    });

    res.json({ ok: true, bug });
  }));

  app.post('/api/events', auth.validateJWT, auth.validateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const event = await appendEvent(clientId, req.body || {});

    recordLearningEvent(clientId, {
      action: String(event?.event || 'event'),
      error: '',
      eventType: 'event',
      meta: event?.meta || {},
      screen: String(event?.screen || 'unknown'),
    });

    res.json({ ok: true, event });
  }));

  app.get('/api/events', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 100)));
    const eventName = String(req.query.event || '').trim();
    const screen = String(req.query.screen || '').trim();
    const events = await listEvents(clientId, { event: eventName, limit, screen });
    res.json(events);
  }));

  app.get('/api/heatmap', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const heatmap = await buildHeatmap(clientId);
    res.json(heatmap);
  }));

  app.post('/api/apply-fix', auth.validateJWT, auth.validateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const file = String(req.body?.file || '').trim();
    const change = String(req.body?.change || '').trim();
    const meta = req.body?.meta || {};
    const fingerprint = meta.fingerprint || '';

    if (!file || !change) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_apply_fix_payload',
      });
    }

    // Checa se já existe fix aplicado para o mesmo fingerprint
    const { readTenantListStoreSync, APPLIED_FIXES_STORE_PATH, normalizeAppliedFixEntry, getTenantBucket, readStoreSync, writeStoreSync, getTenant } = require('./src/server/storage');
    const store = readTenantListStoreSync(APPLIED_FIXES_STORE_PATH, 'appliedFixes', normalizeAppliedFixEntry);
    const bucket = getTenantBucket(store, clientId, 'appliedFixes');
    const alreadyApplied = bucket.find(fix =>
      (fingerprint && fix.meta && fix.meta.fingerprint === fingerprint)
    );
    if (alreadyApplied) {
      // Marca bug como auto-closed se já estava resolvido
      try {
        const bugStore = readStoreSync();
        const tenant = getTenant(bugStore, clientId);
        const bug = tenant.bugs.find(b => b.fingerprint === fingerprint);
        if (bug && !bug.autoClosed) {
          bug.status = 'closed';
          bug.autoClosed = true;
          bug.autoClosedAt = new Date().toISOString();
          bug.autoCloseReason = 'fix_already_applied';
          writeStoreSync(bugStore);
        }
      } catch(e) { console.error('[auto-close][fix_already_applied]', e); }
      return res.status(409).json({
        ok: false,
        error: 'fix_already_applied',
        entry: alreadyApplied,
      });
    }

    // Aplica fix normalmente
    const entry = await recordAppliedFix(clientId, {
      change,
      file,
      meta,
      requestId: req.requestId,
      requestedAt: new Date().toISOString(),
    });

    // Marca bug em fixing antes de entrar em retest.
    try {
      const bugStore = readStoreSync();
      const tenant = getTenant(bugStore, clientId);
      const bug = tenant.bugs.find(b => b.fingerprint === fingerprint);
      if (bug) {
        bug.status = 'fixing';
        bug.fixed = true;
        bug.fixedAt = new Date().toISOString();
        bug.fixedBy = req.auth?.role || 'apply-fix';
        writeStoreSync(bugStore);
      }
    } catch(e) { console.error('[apply-fix][set-fixed]', e); }

    console.log('[apply-fix]', JSON.stringify({
      change,
      clientId,
      file,
      requestId: req.requestId,
    }));

    // Roda retest automático após fix apenas fora de bypass local e quando há fingerprint rastreável.
    const shouldAutoRetest = Boolean(fingerprint) && !req.isQaLocal && req.body?.meta?.disableAutoRetest !== true;
    if (shouldAutoRetest) {
      try {
        const { createRetestService } = require('./src/server/retest');
        const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
        const retestService = createRetestService({ baseUrl: requestBaseUrl });
        retestService.startJob({
          clientId,
          fingerprint,
          meta,
          mode: 'smoke',
          requestedBy: req.auth?.role || 'apply-fix',
          baseUrlOverride: requestBaseUrl,
        });
      } catch(e) { console.error('[apply-fix][auto-retest]', e); }
    }

    return res.json({ ok: true, entry });
  }));
  // Engine de decisão para bug: merge, rollback, resolver
  app.post('/api/bug-decision', auth.validateJWT, auth.validateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const fingerprint = String(req.body?.fingerprint || '').trim();
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    const reason = String(req.body?.reason || '');
    const expectedStatus = String(req.body?.expectedStatus || '').trim().toLowerCase();
    const expectedCountRaw = req.body?.expectedCount;
    const hasExpectedCount = Number.isFinite(Number(expectedCountRaw));
    const expectedCount = hasExpectedCount ? Number(expectedCountRaw) : null;
    if (!fingerprint || !['merge','rollback','resolver'].includes(decision)) {
      return res.status(400).json({ ok: false, error: 'invalid_decision' });
    }
    try {
      const { readStoreSync, writeStoreSync, getTenant } = require('./src/server/storage');
      const store = readStoreSync();
      const tenant = getTenant(store, clientId);
      const bug = tenant.bugs.find(b => b.fingerprint === fingerprint);
      if (!bug) return res.status(404).json({ ok: false, error: 'bug_not_found' });

      const currentStatus = String(bug.status || '').trim().toLowerCase();
      const currentCount = Number(bug.count || 0);
      if ((expectedStatus && expectedStatus !== currentStatus) || (hasExpectedCount && expectedCount !== currentCount)) {
        return res.status(409).json({
          ok: false,
          error: 'stale_bug_state',
          current: {
            count: currentCount,
            status: currentStatus,
          },
          expected: {
            count: hasExpectedCount ? expectedCount : null,
            status: expectedStatus || null,
          },
        });
      }

      bug.decision = decision;
      bug.decisionAt = new Date().toISOString();
      bug.decisionBy = req.auth?.role || 'dashboard';
      bug.decisionReason = reason;
      // Auto-close se decisão for resolver ou merge
      if (decision === 'resolver' || decision === 'merge') {
        bug.status = 'closed';
        bug.resolved = true;
        bug.resolvedAt = new Date().toISOString();
        bug.resolvedBy = req.auth?.role || 'dashboard';
        bug.autoClosed = true;
        bug.autoClosedAt = new Date().toISOString();
        bug.autoCloseReason = `decision:${decision}`;
      } else {
        bug.status = 'rollback';
        bug.autoClosed = false;
      }
      writeStoreSync(store);
      return res.json({ ok: true, bug });
    } catch(e) {
      return res.status(500).json({ ok: false, error: 'decision_failed', details: String(e) });
    }
  }));

  app.get('/api/bugs', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const screen = String(req.query.screen || '').trim();
    const severity = String(req.query.severity || '').trim().toUpperCase();
    const cacheKey = `bugs:${clientId}:${limit}:${screen}:${severity}`;

    const cached = bugsCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const bugs = await listTopBugs(clientId, { limit, screen, severity });
    bugsCache.set(cacheKey, bugs);
    return res.json(bugs);
  }));

  app.get('/api/maintenance/artifacts', auth.authenticateClient, asyncRoute(async (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 40)));
    const folders = await listArtifactFolders({
      includeNestedDetox: req.query.includeNestedDetox !== 'false',
      limit,
    });

    return res.json({
      folders,
      ok: true,
      total: folders.length,
    });
  }));

  app.post('/api/maintenance/cleanup', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const retentionDays = Math.max(0, Math.min(365, Number(req.body?.retentionDays ?? 7)));
    const keepLatestDetox = Math.max(1, Math.min(60, Number(req.body?.keepLatestDetox || 8)));
    const allTenants = Boolean(req.body?.allTenants);

    const bugs = await cleanupResolvedBugs(clientId, { allTenants, retentionDays });
    const detox = await pruneDetoxArtifacts({ keepLatest: keepLatestDetox });
    bugsCache.clear();

    return res.json({
      bugs,
      detox,
      ok: true,
      timestamp: new Date().toISOString(),
    });
  }));

  app.get('/api/insights', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const screen = String(req.query.screen || '').trim();
    const severity = String(req.query.severity || '').trim().toUpperCase();
    const bugs = await listTopBugs(clientId, { limit, screen, severity });
    return res.json(buildInsightsPayload(clientId, bugs));
  }));

  app.post('/api/analyze', auth.authenticateClient, asyncRoute(async (req, res) => {
    const analyzed = analyzeBug(req.body || {});
    res.json({
      category: String(analyzed?.category || 'runtime'),
      priorityLabel: String(analyzed?.priorityLabel || 'P3'),
      rootCause: String(analyzed?.rootCause || analyzed?.message || 'unknown_error'),
      suggestion: String(analyzed?.suggestion || 'Erro desconhecido'),
      trend: analyzed?.trend || { label: 'estavel', delta: 0 },
    });
  }));

  app.post('/api/analyze-batch', auth.authenticateClient, asyncRoute(async (req, res) => {
    const bugs = Array.isArray(req.body) ? req.body : [];
    res.json(analyzeBatch(bugs));
  }));

  app.get('/api/retests', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const mode = String(req.query.mode || '').trim();
    const status = await retestService.listStatus(clientId, { limit, mode });
    res.json(status);
  }));

  app.get('/api/learning', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 200)));
    const events = listLearningEvents(clientId, limit);
    res.json({
      clientId,
      events,
      ok: true,
      total: events.length,
    });
  }));

  app.get('/api/learning/summary', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    res.json(buildLearningSummary(clientId));
  }));

  app.get('/api/ai/status', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const summary = buildLearningSummary(clientId);
    const activeRetests = await retestService.listStatus(clientId, { limit: 10 });
    const queueHealth = await queueSystem.getHealth();
    const queueSize = Object.values(queueHealth.summary || {}).reduce((acc, item) => (
      acc + Number(item?.waiting || 0) + Number(item?.active || 0)
    ), 0);
    res.json({
      aiStatus: activeRetests.active.length > 0 ? 'running' : 'idle',
      clientId,
      generatedAt: new Date().toISOString(),
      learning: summary,
      queueHealth,
      queueSize,
      workerStatus: queueHealth.enabled ? 'running' : 'disabled',
    });
  }));

  app.get('/api/ops/status', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const bugs = await listTopBugs(clientId, { limit: 120 });
    const queueHealth = await queueSystem.getHealth();
    const opened = bugs.filter((bug) => bug.status === 'open').length;
    const resolved = bugs.filter((bug) => bug.status === 'resolved' || bug.status === 'closed').length;
    const inRetest = bugs.filter((bug) => bug.status === 'in_retest').length;
    const critical = bugs.filter((bug) => String(bug.severity || '').toUpperCase() === 'CRITICAL').length;
    const avgFixMs = bugs
      .filter((bug) => bug.fixedAt && bug.firstOccurrence)
      .map((bug) => Math.max(0, new Date(bug.fixedAt).getTime() - new Date(bug.firstOccurrence).getTime()));
    const avgFixTimeMs = avgFixMs.length ? Math.round(avgFixMs.reduce((a, b) => a + b, 0) / avgFixMs.length) : 0;

    res.json({
      bugs: {
        critical,
        inRetest,
        opened,
        resolved,
      },
      ok: true,
      queueHealth,
      stability: {
        avgFixTimeMs,
        total: bugs.length,
      },
      workerStatus: queueHealth.enabled ? 'running' : 'disabled',
    });
  }));

  app.post('/api/test/faults', auth.validateJWT, auth.validateClient, asyncRoute(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    faultProfile.active = Boolean(body.active);
    faultProfile.apiDelayMs = Math.max(0, Number(body.apiDelayMs || 0));
    faultProfile.forceApiError = Boolean(body.forceApiError);

    res.json({ ok: true, faultProfile });
  }));

  app.get('/api/test/faults', auth.authenticateClient, asyncRoute(async (_req, res) => {
    res.json({ ok: true, faultProfile });
  }));

  app.post('/api/retest', auth.authenticateClient, asyncRoute(async (req, res) => {
    const clientId = normalizeClientId(req.clientId || 'default');
    const fingerprint = String(req.body?.fingerprint || '').trim();

    if (fingerprint) {
      try {
        const { readStoreSync, writeStoreSync, getTenant } = require('./src/server/storage');
        const store = readStoreSync();
        const tenant = getTenant(store, clientId);
        const bug = tenant.bugs.find((item) => item.fingerprint === fingerprint);
        if (bug && bug.status !== 'closed') {
          bug.status = 'in_retest';
          writeStoreSync(store);
        }
      } catch (error) {
        console.error('[retest][set-status]', error);
      }
    }

    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const queued = await queueSystem.enqueue('retestQueue', {
      clientId,
      fingerprint,
      meta: req.body?.meta || {},
      mode: req.body?.mode || 'smoke',
      requestedBy: req.auth?.role || 'dashboard',
    }, {
      dedupeKey: `${clientId}:${fingerprint || 'all'}`,
      jobName: 'manual-retest',
      timeout: 240000,
    });

    const started = queued.ok
      ? { started: true, mode: 'queued', queued }
      : retestService.startJob({
          clientId,
          fingerprint,
          meta: req.body?.meta || {},
          mode: req.body?.mode || 'smoke',
          requestedBy: req.auth?.role || 'dashboard',
          baseUrlOverride: requestBaseUrl,
        });

    res.status(started.started ? 202 : 200).json(started);
  }));

  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use((err, req, res, _next) => {
    console.error('[error]', JSON.stringify({
      message: String(err?.message || 'internal_error'),
      path: req.path,
      requestId: req.requestId,
      stack: String(err?.stack || '').split('\n').slice(0, 4).join('\n'),
    }));
    res.status(500).json({
      ok: false,
      error: 'internal_error',
      requestId: req.requestId,
    });
  });

  return app;
}

function startServer(port = PORT) {
  const app = createApp();
  const server = app.listen(port, () => {
    const activePort = server.address()?.port || port;
    console.log('Server running on port', activePort);
    console.log('🚀 Server running on port', activePort);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
};
