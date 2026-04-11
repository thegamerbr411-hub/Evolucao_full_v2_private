const { Worker } = require('bullmq');

const { analyzeBug } = require('../src/server/analysis');
const { getQueueSystem } = require('../src/server/queue');
const { readStoreSync, getTenant, normalizeClientId, writeStoreSync } = require('../src/server/storage');

function ensureConnection() {
  const queueSystem = getQueueSystem();
  if (!queueSystem.enabled || !queueSystem.connection) {
    throw new Error('REDIS_URL_not_configured');
  }
  return queueSystem;
}

function getConfidence(analyzed = {}) {
  const severity = String(analyzed.severity || 'LOW').toUpperCase();
  const count = Number(analyzed.count || 1);
  const trend = String(analyzed?.trend?.label || 'estavel');
  let score = 0.4;

  if (severity === 'CRITICAL') score += 0.35;
  if (severity === 'HIGH') score += 0.2;
  if (count >= 10) score += 0.2;
  if (trend === 'subindo' || trend === 'novo') score += 0.1;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function createAiWorker() {
  const queueSystem = ensureConnection();
  const minConfidence = Number(process.env.MIN_FIX_CONFIDENCE || 0.65);

  return new Worker('aiQueue', async (job) => {
    const payload = job.data || {};
    const clientId = normalizeClientId(payload.clientId || 'default');
    const fingerprint = String(payload.fingerprint || '').trim();

    if (!fingerprint) {
      return { ignored: true, reason: 'missing_fingerprint' };
    }

    const store = readStoreSync();
    const tenant = getTenant(store, clientId);
    const bug = tenant.bugs.find((item) => item.fingerprint === fingerprint);
    if (!bug) {
      return { ignored: true, reason: 'bug_not_found' };
    }

    const analyzed = analyzeBug(bug);
    const confidence = getConfidence(analyzed);

    if (bug.lastFixFingerprint && bug.lastFixFingerprint === fingerprint) {
      return { ignored: true, reason: 'fix_reapply_blocked' };
    }

    if (confidence < minConfidence) {
      bug.aiStatus = 'low_confidence';
      bug.aiConfidence = confidence;
      bug.lastAiAnalyzedAt = new Date().toISOString();
      writeStoreSync(store);
      return { ignored: true, confidence, reason: 'below_confidence_threshold' };
    }

    await queueSystem.enqueue('fixQueue', {
      analysis: analyzed,
      clientId,
      confidence,
      fingerprint,
      meta: payload.meta || {},
      source: 'aiWorker',
      suggestion: analyzed.suggestion,
    }, {
      dedupeKey: `${clientId}:${fingerprint}`,
      jobName: 'generate-fix',
      timeout: 180000,
    });

    bug.aiStatus = 'queued_fix';
    bug.aiConfidence = confidence;
    bug.lastAiAnalyzedAt = new Date().toISOString();
    writeStoreSync(store);

    return {
      confidence,
      fingerprint,
      queued: true,
      suggestion: analyzed.suggestion,
    };
  }, {
    connection: queueSystem.connection,
    concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 2),
  });
}

module.exports = {
  createAiWorker,
};
