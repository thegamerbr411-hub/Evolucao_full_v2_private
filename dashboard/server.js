const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { analyzeBatch, analyzeBug } = require('./src/server/analysis');
const { createAuth } = require('./src/server/auth');
const { createTTLCache } = require('./src/server/cache');
const { normalizeIncomingLog } = require('./src/server/logs');
const { createSlidingWindowLimiter } = require('./src/server/rateLimit');
const { listTopBugs, normalizeClientId, upsertBug } = require('./src/server/storage');

const PORT = Number(process.env.PORT || 3000);
const BUGS_CACHE_TTL_MS = Number(process.env.BUGS_CACHE_TTL_MS || 5000);

function createApp() {
  const app = express();
  const auth = createAuth({
    adminPass: process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD,
    adminUser: process.env.ADMIN_USER || process.env.ADMIN_EMAIL,
    clientKeyMap: process.env.CLIENT_API_KEYS,
    defaultClientId: process.env.DEFAULT_CLIENT_ID || 'default',
    secret: process.env.JWT_SECRET,
  });
  const bugsCache = createTTLCache(BUGS_CACHE_TTL_MS);

  app.disable('x-powered-by');
  app.use(cors({ origin: '*' }));
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

  function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
  }

  const apiLimiter = createSlidingWindowLimiter({
    getKey: (req) => {
      const clientId = normalizeClientId(req.headers['x-client-id'] || req.headers['x-api-key'] || req.ip || 'unknown');
      return `${clientId}:${req.path}`;
    },
    max: Number(process.env.RATE_LIMIT_MAX || 180),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  });
  app.use('/api', apiLimiter);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/login', auth.handleLogin);
  app.post('/token/client', auth.authenticateAdmin, auth.handleClientToken);

  app.post('/api/log', auth.authenticateClient, asyncRoute(async (req, res) => {
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

    res.status(201).json({
      ok: true,
      clientId,
      fingerprint: normalized.fingerprint,
    });
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

  app.post('/api/analyze', auth.authenticateClient, asyncRoute(async (req, res) => {
    const analyzed = analyzeBug(req.body || {});
    res.json({
      rootCause: String(analyzed?.message || 'unknown_error'),
      suggestion: String(analyzed?.suggestion || 'Erro desconhecido'),
    });
  }));

  app.post('/api/analyze-batch', auth.authenticateClient, asyncRoute(async (req, res) => {
    const bugs = Array.isArray(req.body) ? req.body : [];
    res.json(analyzeBatch(bugs));
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
  return app.listen(port, () => {
    console.log(`QA dashboard API running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
};
