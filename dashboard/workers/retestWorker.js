const { Worker } = require('bullmq');

const { getQueueSystem } = require('../src/server/queue');
const { createRetestService } = require('../src/server/retest');
const { getTenant, normalizeClientId, readStoreSync, writeStoreSync } = require('../src/server/storage');

function ensureConnection() {
  const queueSystem = getQueueSystem();
  if (!queueSystem.enabled || !queueSystem.connection) {
    throw new Error('REDIS_URL_not_configured');
  }
  return queueSystem;
}

function shouldAutoClose(bug) {
  const count = Number(bug?.count || 0);
  const severity = String(bug?.severity || 'LOW').toUpperCase();
  return severity !== 'CRITICAL' && count <= 2;
}

function createRetestWorker() {
  const queueSystem = ensureConnection();
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const defaultBaseUrl = String(process.env.PUBLIC_API_BASE_URL || process.env.RENDER_EXTERNAL_URL || (isProduction ? '' : 'http://127.0.0.1:3000')).trim();

  return new Worker('retestQueue', async (job) => {
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

    bug.retestAttempts = Number(bug.retestAttempts || 0) + 1;
    if (bug.retestAttempts > 5) {
      bug.status = 'open';
      bug.retestLoopBlocked = true;
      writeStoreSync(store);
      return { ignored: true, reason: 'max_retest_attempts' };
    }

    const retestService = createRetestService({
      baseUrl: defaultBaseUrl,
    });

    const started = retestService.startJob({
      baseUrlOverride: defaultBaseUrl || undefined,
      clientId,
      fingerprint,
      meta: payload.meta || {},
      mode: String(payload.mode || 'smoke'),
      requestedBy: 'retestWorker',
    });

    if (!started.started) {
      return { ignored: true, reason: 'retest_not_started', started };
    }

    if (shouldAutoClose(bug)) {
      bug.status = 'closed';
      bug.resolved = true;
      bug.resolvedBy = 'retestWorker';
      bug.resolvedAt = new Date().toISOString();
      bug.autoClosed = true;
      bug.autoClosedAt = new Date().toISOString();
      bug.autoCloseReason = 'retest_auto_close_policy';
    } else {
      bug.status = 'resolved';
      bug.resolved = true;
      bug.resolvedBy = 'retestWorker';
      bug.resolvedAt = new Date().toISOString();
    }

    writeStoreSync(store);

    return {
      autoClosed: Boolean(bug.autoClosed),
      fingerprint,
      started,
      status: bug.status,
    };
  }, {
    connection: queueSystem.connection,
    concurrency: Number(process.env.RETEST_WORKER_CONCURRENCY || 1),
  });
}

module.exports = {
  createRetestWorker,
};
