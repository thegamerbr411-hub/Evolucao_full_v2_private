const { Worker } = require('bullmq');

const { getQueueSystem } = require('../src/server/queue');
const {
  getTenant,
  normalizeClientId,
  readStoreSync,
  recordAppliedFix,
  writeStoreSync,
} = require('../src/server/storage');

function ensureConnection() {
  const queueSystem = getQueueSystem();
  if (!queueSystem.enabled || !queueSystem.connection) {
    throw new Error('REDIS_URL_not_configured');
  }
  return queueSystem;
}

function createFixWorker() {
  const queueSystem = ensureConnection();

  return new Worker('fixQueue', async (job) => {
    const payload = job.data || {};
    const clientId = normalizeClientId(payload.clientId || 'default');
    const fingerprint = String(payload.fingerprint || '').trim();
    const confidence = Number(payload.confidence || 0);
    const suggestion = String(payload.suggestion || payload.analysis?.suggestion || '').trim();

    if (!fingerprint || !suggestion) {
      return { ignored: true, reason: 'invalid_fix_payload' };
    }

    const store = readStoreSync();
    const tenant = getTenant(store, clientId);
    const bug = tenant.bugs.find((item) => item.fingerprint === fingerprint);
    if (!bug) {
      return { ignored: true, reason: 'bug_not_found' };
    }

    if (bug.lastFixSuggestion && bug.lastFixSuggestion === suggestion) {
      return { ignored: true, reason: 'same_fix_blocked' };
    }

    const entry = await recordAppliedFix(clientId, {
      change: suggestion,
      file: String(payload.file || bug.screen || 'src/unknown.js'),
      meta: {
        ...payload.meta,
        confidence,
        fingerprint,
        generatedBy: 'fixWorker',
      },
      requestId: `fix-worker-${Date.now()}`,
      requestedAt: new Date().toISOString(),
    });

    bug.status = 'in_retest';
    bug.fixed = true;
    bug.fixedAt = new Date().toISOString();
    bug.fixedBy = 'fixWorker';
    bug.lastFixSuggestion = suggestion;
    bug.lastFixFingerprint = fingerprint;
    bug.retestAttempts = Number(bug.retestAttempts || 0);
    writeStoreSync(store);

    await queueSystem.enqueue('retestQueue', {
      clientId,
      fingerprint,
      fixEntryId: entry?.requestId || '',
      mode: 'smoke',
      source: 'fixWorker',
    }, {
      dedupeKey: `${clientId}:${fingerprint}`,
      jobName: 'run-retest',
      timeout: 240000,
    });

    return {
      applied: true,
      fingerprint,
      queuedRetest: true,
    };
  }, {
    connection: queueSystem.connection,
    concurrency: Number(process.env.FIX_WORKER_CONCURRENCY || 1),
  });
}

module.exports = {
  createFixWorker,
};
