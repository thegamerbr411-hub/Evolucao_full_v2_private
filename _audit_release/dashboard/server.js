const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
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
  getExerciseProgress,
  getXpFormula,
  getRanking,
  getUserStats,
  getWorkoutById,
  listUserWorkouts,
  normalizeUserId: normalizeWorkoutUserId,
  saveWorkout,
} = require('./src/server/workouts');
const {
  getHydrationSummary,
  listHydration,
  normalizeTimezone,
  saveHydration,
} = require('./src/server/hydration');
const {
  addFriend,
  createChallenge,
  getSocialOverview,
  joinChallenge,
  updateChallengeProgress,
} = require('./src/server/social');
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
const {
  analyzeSubmission,
  validateSubmissionPayload,
} = require('./src/server/catalogAnalyzer');
const {
  createSubmission,
  listSubmissions,
  getSubmission,
  approveSubmission,
  rejectSubmission,
  getOfficialCatalog,
  getOfficialTitles,
  getPendingTitles,
} = require('./src/server/catalog');

const PORT = Number(process.env.PORT || 3000);
const BUGS_CACHE_TTL_MS = Number(process.env.BUGS_CACHE_TTL_MS || 5000);
const faultProfile = {
  active: false,
  apiDelayMs: 0,
  forceApiError: false,
};

const pendingEmailCodes = new Map();
const pendingResetTokens = new Map();

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || '').trim();
  if (!apiKey || !from) return false;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function sendTransactionalEmail({ to, subject, text, html }) {
  const resendDelivered = await sendWithResend({ to, subject, text, html });
  if (resendDelivered) {
    return true;
  }

  const transporter = createSmtpTransporter();
  if (!transporter) {
    return false;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return true;
}

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

  function getRequestTimezone(req) {
    return normalizeTimezone(
      req.headers['x-user-timezone']
      || req.query?.timezone
      || req.body?.timezone
      || req.body?.userTimezone
      || 'UTC'
    );
  }

  function requireChallengeAdmin(req, res, next) {
    const role = String(req.auth?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || Boolean(req.auth?.isAdmin);
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'admin_required' });
    }
    return next();
  }

  function resolveRequestUserId(req) {
    const authUserId = normalizeWorkoutUserId(
      req.auth?.id || req.auth?.userId || req.auth?.sub || ''
    );
    const bodyUserId = normalizeWorkoutUserId(req.body?.userId || '');
    const queryUserId = normalizeWorkoutUserId(req.query?.userId || '');
    const requestUserId = bodyUserId || queryUserId;

    if (authUserId && requestUserId && authUserId !== requestUserId) {
      return null;
    }

    return authUserId || requestUserId || '';
  }

  function requireUserContext(req, res, next) {
    const userId = resolveRequestUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'missing_user_id' });
    }

    req.userId = userId;
    req.userTimezone = getRequestTimezone(req);
    return next();
  }

  function sanitizeText(value, { max = 120, fallback = '' } = {}) {
    const text = String(value ?? fallback).replace(/\s+/g, ' ').trim();
    return text.slice(0, max);
  }

  function toFiniteNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  function requireAppApiKey(req, res, next) {
    const hasBearer = String(req.headers.authorization || '').trim().startsWith('Bearer ');
    if (hasBearer) {
      return next();
    }

    const expected = String(process.env.APP_API_KEY || process.env.QA_APP_API_KEY || '').trim();
    if (!expected) {
      return next();
    }

    const provided = String(req.headers['x-api-key'] || '').trim();
    if (!provided || provided !== expected) {
      return res.status(401).json({ ok: false, error: 'invalid_api_key' });
    }

    return next();
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
  app.post('/auth/login', auth.handleLogin);
  app.post('/token/client', auth.authenticateAdmin, auth.handleClientToken);

  app.post('/auth/send-code', asyncRoute(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'E-mail inválido.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000;
    pendingEmailCodes.set(email, { code, expiresAt });

    console.log('[email][send-code] template_version= ascii_safe_20260530')
    const delivered = await sendTransactionalEmail({
      to: email,
      subject: 'Seu codigo de verificacao - Evolucao',
      text: [
        'Codigo de verificacao',
        '',
        `Seu codigo: ${code}`,
        '',
        'Expira em 15 minutos.',
        '',
        'Se voce nao solicitou este codigo, ignore este email.',
      ].join('\n'),
      html: `<h2>Codigo de verificacao</h2><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p>Expira em 15 minutos.</p>`,
    });

    if (!delivered) {
      return res.status(503).json({ ok: false, error: 'Servico de e-mail indisponivel no momento.' });
    }

    return res.json({ ok: true, delivery: 'email' });
  }));

  app.post('/auth/verify-code', asyncRoute(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    const entry = pendingEmailCodes.get(email);
    if (!entry) {
      return res.status(400).json({ ok: false, error: 'Código não encontrado ou expirado.' });
    }

    if (Date.now() > entry.expiresAt) {
      pendingEmailCodes.delete(email);
      return res.status(400).json({ ok: false, error: 'Código expirado. Solicite um novo.' });
    }

    if (code !== entry.code) {
      return res.status(400).json({ ok: false, error: 'Código incorreto.' });
    }

    pendingEmailCodes.delete(email);
    return res.json({ ok: true });
  }));

  app.post('/auth/forgot-password', asyncRoute(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'E-mail inválido.' });
    }

    const resetToken = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const expiresAt = Date.now() + (30 * 60 * 1000);
    pendingResetTokens.set(email, { token: resetToken, expiresAt });

    const resetBaseUrl = String(process.env.PASSWORD_RESET_URL || process.env.FRONTEND_URL || '').trim();
    const resetLink = resetBaseUrl
      ? `${resetBaseUrl.replace(/\/+$/, '')}?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`
      : `Token de recuperação: ${resetToken}`;

    const delivered = await sendTransactionalEmail({
      to: email,
      subject: 'Recuperação de senha — Evolução App',
      text: `Você solicitou recuperação de senha.\n\n${resetLink}\n\nExpira em 30 minutos.`,
      html: `<h2>Recuperação de senha</h2><p>Use o link abaixo para redefinir sua senha:</p><p><a href="${String(resetLink).replace(/"/g, '&quot;')}">${resetLink}</a></p><p>Expira em 30 minutos.</p>`,
    });

    if (!delivered) {
      return res.status(503).json({ ok: false, error: 'Servico de e-mail indisponivel no momento.' });
    }

    return res.json({ ok: true, delivery: 'email' });
  }));

  app.post('/api/workouts', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const exercises = Array.isArray(req.body?.exercises) ? req.body.exercises : [];

    if (!exercises.length) {
      return res.status(400).json({ ok: false, error: 'invalid_workout_payload' });
    }

    const workout = await saveWorkout({
      ...req.body,
      userId,
      userTimezone: req.userTimezone,
      createdAt: req.body?.createdAt || new Date().toISOString(),
    });

    if (!workout) {
      return res.status(400).json({ ok: false, error: 'invalid_workout_payload' });
    }

    return res.json({
      ok: true,
      plan: String(workout.plan || 'free'),
      subscriptionStatus: String(workout.plan || 'free') === 'premium' ? 'active' : 'free',
      upgradeAvailable: String(workout.plan || 'free') !== 'premium',
      workout,
    });
  }));

  app.get('/api/workouts', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    return res.json(listUserWorkouts(userId, limit));
  }));

  app.get('/api/workouts/:id', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    const found = getWorkoutById(userId, req.params.id);
    if (!found) {
      return res.status(404).json({ ok: false, error: 'workout_not_found' });
    }
    return res.json(found);
  }));

  app.get('/api/stats', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const stats = getUserStats(userId);
    const hydration = getHydrationSummary(userId, req.userTimezone);
    return res.json({
      ...stats,
      hydration,
    });
  }));

  app.get('/api/streak', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const stats = getUserStats(userId);
    return res.json({
      streakDays: Number(stats.streak || 0),
      totalWorkouts: Number(stats.totalWorkouts || 0),
    });
  }));

  app.get('/api/ranking', requireAppApiKey, asyncRoute(async (req, res) => {
    const metric = String(req.query.metric || 'consistency').toLowerCase();
    return res.json(getRanking(metric));
  }));

  app.get('/api/gamification/formula', requireAppApiKey, asyncRoute(async (_req, res) => {
    return res.json({
      ok: true,
      formula: getXpFormula(),
      updatedAt: new Date().toISOString(),
    });
  }));

  app.get('/api/leaderboard', requireAppApiKey, asyncRoute(async (req, res) => {
    const metric = String(req.query.metric || 'consistency').toLowerCase();
    const ranking = getRanking(metric);
    return res.json({
      metric,
      ranking,
      updatedAt: new Date().toISOString(),
    });
  }));

  app.get('/api/ranking/micro', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const metric = String(req.query.metric || 'xp').toLowerCase();
    const radius = Math.max(1, Math.min(5, Number(req.query.radius || 2)));
    const ranking = getRanking(metric);
    const meIndex = ranking.findIndex((item) => item.userId === req.userId);
    if (meIndex < 0) {
      return res.json({ ok: true, metric, ranking: [], userId: req.userId });
    }

    const start = Math.max(0, meIndex - radius);
    const end = Math.min(ranking.length, meIndex + radius + 1);
    return res.json({
      ok: true,
      metric,
      userId: req.userId,
      ranking: ranking.slice(start, end),
      total: ranking.length,
    });
  }));

  app.get('/api/me/stats', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    const stats = getUserStats(userId);
    const hydration = getHydrationSummary(userId, req.userTimezone);
    const progress = getExerciseProgress(userId);
    const rankingXp = getRanking('xp');
    const rankingConsistency = getRanking('consistency');
    const rankingVolume = getRanking('volume');
    const xpPosition = rankingXp.find((item) => item.userId === userId) || null;
    const consistencyPosition = rankingConsistency.find((item) => item.userId === userId) || null;
    const volumePosition = rankingVolume.find((item) => item.userId === userId) || null;
    const plan = String(req.query.plan || req.headers['x-plan'] || 'free').toLowerCase() === 'premium' ? 'premium' : 'free';
    return res.json({
      ...stats,
      exerciseProgress: progress,
      rankings: {
        xp: xpPosition ? { rank: xpPosition.rank, score: xpPosition.xpScore } : null,
        consistency: consistencyPosition ? { rank: consistencyPosition.rank, score: consistencyPosition.consistencyScore } : null,
        volume: volumePosition ? { rank: volumePosition.rank, score: volumePosition.volumeScore } : null,
      },
      league: xpPosition?.league || 'Bronze',
      plan,
      subscriptionStatus: plan === 'premium' ? 'active' : 'free',
      upgradeAvailable: plan !== 'premium',
      hydration,
      userId,
    });
  }));

  app.get('/api/coach/insight', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    const stats = getUserStats(userId);
    const hydration = getHydrationSummary(userId, req.userTimezone);
    const progress = getExerciseProgress(userId);
    const xpRanking = getRanking('xp');
    const xpPosition = xpRanking.find((item) => item.userId === userId) || null;
    const bestExercise = progress[0] || null;
    const stalledExercise = progress.find((item) => item.stable) || null;

    let message = 'Continue treinando, ainda não tenho dados suficientes.';
    if (Number(stats.totalWorkouts || 0) >= 3) {
      if (Number(stats.trendPct || 0) >= 5) {
        message = `Você está consistente e evoluindo. Sua tendência está em +${stats.trendPct}%.`;
      } else if (Number(stats.trendPct || 0) <= -5) {
        message = 'Sua carga média caiu na janela recente. Considere reduzir volume por 1 dia e recuperar.';
      } else {
        message = 'Sua rotina está estabilizada. Tente progressão leve de carga no próximo treino.';
      }
    }

    if (Number(hydration?.goalAchievedDays || 0) <= 1 && Number(stats.totalWorkouts || 0) >= 2) {
      message = `${message} Priorize água hoje para melhorar recuperação.`;
    }

    return res.json({
      bestExercise,
      message,
      stalledExercise,
      stats,
      hydration,
      rankings: {
        xp: xpPosition ? { rank: xpPosition.rank, score: xpPosition.xpScore, pointsToPass: xpPosition.pointsToPass } : null,
      },
      userId,
    });
  }));

  app.get('/api/social/overview', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    return res.json(getSocialOverview(userId));
  }));

  app.post('/api/social/friends/add', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const friendUserId = normalizeWorkoutUserId(req.body?.friendUserId || req.body?.friendId || '');
    if (!userId || !friendUserId) {
      return res.status(400).json({ ok: false, error: 'invalid_friend_payload' });
    }

    const result = await addFriend(userId, friendUserId);
    if (!result?.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }));

  app.post('/api/social/challenges', requireAppApiKey, auth.validateJWT, requireChallengeAdmin, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const title = sanitizeText(req.body?.title, { max: 120 });
    const type = sanitizeText(req.body?.type || 'workouts_count', { max: 40, fallback: 'workouts_count' });
    const target = toFiniteNumber(req.body?.target, { min: 1, max: 365, fallback: 3 });

    if (!title) {
      return res.status(400).json({ ok: false, error: 'invalid_challenge_payload' });
    }

    const result = await createChallenge({
      ...req.body,
      title,
      type,
      target,
      createdBy: userId,
      userId,
    });

    if (!result?.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }));

  app.post('/api/social/challenges/:id/join', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    const result = await joinChallenge(req.params.id, userId);
    if (!result?.ok) {
      return res.status(404).json(result);
    }
    return res.json(result);
  }));

  app.post('/api/social/challenges/:id/progress', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const userId = req.userId;

    const progress = toFiniteNumber(req.body?.progress, { min: 0, max: 100000, fallback: 0 });
    const result = await updateChallengeProgress(req.params.id, userId, progress);
    if (!result?.ok) {
      return res.status(404).json(result);
    }
    return res.json(result);
  }));

  app.post('/api/hydration', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const ml = toFiniteNumber(req.body?.ml || req.body?.amount, { min: 1, max: 5000, fallback: 0 });
    if (!Number.isFinite(ml) || ml <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_hydration_payload' });
    }

    const persisted = saveHydration({
      id: req.body?.id,
      userId: req.userId,
      ml,
      occurredAt: req.body?.occurredAt || new Date().toISOString(),
      source: req.body?.source || 'app',
      timezone: req.userTimezone,
    });

    if (!persisted?.ok) {
      return res.status(400).json({ ok: false, error: persisted?.error || 'invalid_hydration_payload' });
    }

    return res.json({
      ok: true,
      deduped: Boolean(persisted?.deduped),
      entry: persisted.entry,
      summary: getHydrationSummary(req.userId, req.userTimezone),
    });
  }));

  app.get('/api/hydration', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const dayKey = String(req.query.dayKey || '').trim() || null;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const timezone = req.userTimezone;
    const summary = getHydrationSummary(req.userId, timezone, dayKey);
    const entries = listHydration(req.userId, limit);

    return res.json({
      ok: true,
      summary,
      entries,
    });
  }));

  // Subscription management (MVP: persisted in-memory, replace with DB for production)
  const subscriptionStore = new Map()

  app.post('/api/subscription/activate', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const { type = 'trial' } = req.body || {}
    if (!['trial', 'pro'].includes(String(type))) {
      return res.status(400).json({ ok: false, error: 'invalid_subscription_type' })
    }
    const trialDays = 7
    const proDays = 30
    const daysToAdd = type === 'trial' ? trialDays : proDays
    const now = Date.now()
    const expiry = now + daysToAdd * 24 * 60 * 60 * 1000
    const entry = {
      userId: req.userId,
      plan: type === 'trial' ? 'trial' : 'pro',
      isProActive: true,
      isPro: true,
      proExpiry: expiry,
      activatedAt: new Date(now).toISOString(),
    }
    subscriptionStore.set(req.userId, entry)
    return res.json({ ok: true, data: entry })
  }))

  app.get('/api/subscription/status', requireAppApiKey, requireUserContext, asyncRoute(async (req, res) => {
    const entry = subscriptionStore.get(req.userId) || null
    const now = Date.now()
    const isActive = entry && entry.proExpiry && Number(entry.proExpiry) > now
    return res.json({
      ok: true,
      data: {
        isPro: Boolean(isActive),
        isProActive: Boolean(isActive),
        plan: isActive ? entry.plan : 'free',
        proExpiry: entry?.proExpiry || null,
      },
    })
  }))

  app.post('/api/log', auth.validateJWT, auth.validateClient, asyncRoute(async (req, res) => {
    const normalized = normalizeIncomingLog({
      ...(req.body || {}),
      userId: resolveRequestUserId(req),
    });
    const clientId = normalizeClientId(req.clientId || 'default');
    const bug = await upsertBug(clientId, normalized);

    bugsCache.clear(`bugs:${clientId}:`);

    if (!bug?.synthetic && Number(bug?.count || 0) > 10 && bug?.severity === 'HIGH') {
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
    const event = await appendEvent(clientId, {
      ...(req.body || {}),
      userId: resolveRequestUserId(req),
    });

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

  app.get('/api/admin/env-check', auth.authenticateAdmin, asyncRoute(async (_req, res) => {
    const required = ['ADMIN_USER', 'ADMIN_PASS', 'JWT_SECRET', 'DEFAULT_CLIENT_ID', 'CLIENT_API_KEYS'];
    const missing = required.filter((key) => String(process.env[key] || '').trim().length === 0);
    return res.json({
      ok: missing.length === 0,
      missing,
      required,
    });
  }));

  // ── Catalog routes ────────────────────────────────────────────────────────

  // POST /api/catalog/submit — qualquer cliente autenticado pode submeter
  app.post('/api/catalog/submit', auth.authenticateClient, asyncRoute(async (req, res) => {
    const validation = validateSubmissionPayload(req.body || {});
    if (!validation.valid) {
      return res.status(400).json({ ok: false, errors: validation.errors });
    }

    const payload = {
      ...validation.payload,
      createdBy: String(req.auth?.clientId || req.auth?.user || validation.payload.createdBy || 'admin'),
      source: validation.payload.source || 'dashboard',
    };

    const existingTitles = [...getOfficialTitles(), ...getPendingTitles()];
    const analysis = analyzeSubmission(payload, existingTitles);

    if (analysis.isDuplicate) {
      return res.status(409).json({
        ok: false,
        error: 'Já existe item com este título no catálogo (oficial ou pendente).',
        analysis,
      });
    }

    const submission = createSubmission({ ...payload, analysis });
    return res.status(201).json({
      ok: true,
      submission,
      analysis,
      reviewHint: analysis.isValid
        ? 'Submissão válida, aguardando revisão de admin.'
        : 'Submissão pendente com alertas de qualidade. Revise antes de aprovar.',
    });
  }));

  // GET /api/catalog/pending — somente admin
  app.get('/api/catalog/pending', auth.authenticateAdmin, asyncRoute(async (_req, res) => {
    const items = listSubmissions({ status: 'pending', limit: 200 });
    return res.json({ ok: true, items });
  }));

  // GET /api/catalog/official — leitura pública (somente itens aprovados)
  app.get('/api/catalog/official', asyncRoute(async (req, res) => {
    const type = req.query.type || null;
    const catalog = getOfficialCatalog(type ? { type } : {});
    return res.json({ ok: true, ...catalog });
  }));

  // GET /api/catalog/all — admin lista todas as submissions (qualquer status)
  app.get('/api/catalog/all', auth.authenticateAdmin, asyncRoute(async (req, res) => {
    const status = req.query.status || null;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const items = listSubmissions({ status: status || null, limit });
    return res.json({ ok: true, items });
  }));

  // POST /api/catalog/:id/approve — somente admin
  app.post('/api/catalog/:id/approve', auth.authenticateAdmin, asyncRoute(async (req, res) => {
    const { id } = req.params;
    if (!id || !/^sub-\d+-[0-9a-f]+$/.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID de submissão inválido.' });
    }

    const submission = getSubmission(id);
    if (!submission) {
      return res.status(404).json({ ok: false, error: 'Submissão não encontrada.' });
    }
    if (submission.status !== 'pending') {
      return res.status(409).json({ ok: false, error: `Submissão já foi ${submission.status}.` });
    }

    const reviewedBy = String(req.auth?.user || 'admin');
    const approved = approveSubmission(id, { reviewedBy });
    return res.json({ ok: true, submission: approved });
  }));

  // POST /api/catalog/:id/reject — somente admin
  app.post('/api/catalog/:id/reject', auth.authenticateAdmin, asyncRoute(async (req, res) => {
    const { id } = req.params;
    if (!id || !/^sub-\d+-[0-9a-f]+$/.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID de submissão inválido.' });
    }

    const submission = getSubmission(id);
    if (!submission) {
      return res.status(404).json({ ok: false, error: 'Submissão não encontrada.' });
    }
    if (submission.status !== 'pending') {
      return res.status(409).json({ ok: false, error: `Submissão já foi ${submission.status}.` });
    }

    const rejectionReason = String((req.body || {}).reason || 'Recusado pelo administrador.').trim().slice(0, 300);
    if (!rejectionReason) {
      return res.status(400).json({ ok: false, error: 'Motivo de recusa é obrigatório.' });
    }

    const reviewedBy = String(req.auth?.user || 'admin');
    const rejected = rejectSubmission(id, { reviewedBy, rejectionReason });
    return res.json({ ok: true, submission: rejected });
  }));

  // ── End catalog routes ────────────────────────────────────────────────────

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
