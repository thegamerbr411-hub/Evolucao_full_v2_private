const path = require('path');
const { spawn } = require('child_process');

const { listRetestRuns, normalizeClientId, recordRetestRun } = require('./storage');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function normalizeMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'detox') return 'detox-cycle';
  if (normalized === 'night') return 'night-run';
  if (normalized === 'night-run') return 'night-run';
  if (normalized === 'detox-cycle') return 'detox-cycle';
  return 'smoke';
}

function getModeConfig(mode, baseUrl) {
  const safeMode = normalizeMode(mode);
  if (safeMode === 'detox-cycle') {
    return {
      args: ['scripts/run-detox-cycle.js'],
      command: 'node',
      env: {},
    };
  }

  if (safeMode === 'night-run') {
    return {
      args: ['dashboard/scripts/night-run.js'],
      command: 'node',
      env: {
        NIGHT_RUN_ONCE: '1',
      },
    };
  }

  return {
    args: ['scripts/test-flow.js'],
    command: 'node',
    env: {
      BASE_URL: baseUrl,
    },
  };
}

function createRetestService(options = {}) {
  const activeJobs = new Map();
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const baseUrl = String(options.baseUrl || (isProduction ? '' : 'http://127.0.0.1:3000')).trim();

  async function listStatus(clientId, retestOptions = {}) {
    const safeClientId = normalizeClientId(clientId);
    const active = Array.from(activeJobs.values())
      .filter((job) => job.clientId === safeClientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const history = await listRetestRuns(safeClientId, retestOptions);
    return { active, history };
  }

  async function finalizeJob(jobId, patch = {}) {
    const current = activeJobs.get(jobId);
    if (!current) {
      return null;
    }

    const finished = {
      ...current,
      ...patch,
      finishedAt: patch.finishedAt || new Date().toISOString(),
    };

    await recordRetestRun(current.clientId, finished);

    // Se passou, marcar bug como resolvido
    if (finished.status === 'passed' && finished.fingerprint) {
      try {
        const { readStoreSync, writeStoreSync, getTenant, normalizeClientId } = require('./storage');
        const store = readStoreSync();
        const tenant = getTenant(store, normalizeClientId(current.clientId));
        const bug = tenant.bugs.find(b => b.fingerprint === finished.fingerprint);
        if (bug) {
          bug.status = 'closed';
          bug.fixed = true;
          bug.resolved = true;
          bug.resolvedAt = finished.finishedAt;
          bug.resolvedBy = finished.requestedBy || 'retest';
          bug.autoClosed = true;
          bug.autoClosedAt = finished.finishedAt;
          bug.autoCloseReason = 'retest_passed';
          writeStoreSync(store);
        }
      } catch (e) {
        console.error('[retest][auto-resolve-bug] erro ao marcar bug resolvido:', e);
      }
    } else if (finished.status === 'failed' && finished.fingerprint) {
      try {
        const { readStoreSync, writeStoreSync, getTenant, normalizeClientId } = require('./storage');
        const store = readStoreSync();
        const tenant = getTenant(store, normalizeClientId(current.clientId));
        const bug = tenant.bugs.find(b => b.fingerprint === finished.fingerprint);
        if (bug) {
          bug.status = 'retest_failed';
          writeStoreSync(store);
        }
      } catch (e) {
        console.error('[retest][mark-failed] erro ao atualizar bug:', e);
      }
    }

    activeJobs.delete(jobId);
    return finished;
  }

  function startJob({ clientId, fingerprint = '', meta = {}, mode = 'smoke', requestedBy = 'dashboard', baseUrlOverride = '' }) {
    const safeClientId = normalizeClientId(clientId);
    const safeMode = normalizeMode(mode);

    const alreadyRunning = Array.from(activeJobs.values()).find((job) => {
      return job.clientId === safeClientId && job.mode === safeMode && job.status === 'running';
    });

    if (alreadyRunning) {
      return {
        ok: true,
        started: false,
        job: alreadyRunning,
      };
    }

    const jobId = `${safeClientId}-${safeMode}-${Date.now()}`;
    const effectiveBaseUrl = String(baseUrlOverride || baseUrl || (isProduction ? '' : 'http://127.0.0.1:3000')).trim();
    const config = getModeConfig(safeMode, effectiveBaseUrl);
    const job = {
      clientId: safeClientId,
      createdAt: new Date().toISOString(),
      fingerprint: String(fingerprint || '').trim(),
      jobId,
      meta: meta && typeof meta === 'object' ? meta : {},
      mode: safeMode,
      requestedBy: String(requestedBy || 'dashboard'),
      status: 'running',
    };

    activeJobs.set(jobId, job);

    const child = spawn(config.command, config.args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        ...config.env,
        QA_CLIENT_ID: safeClientId,
      },
      shell: false,
      stdio: 'inherit',
    });

    job.pid = child.pid;

    child.on('close', async (code) => {
      await finalizeJob(jobId, {
        exitCode: Number(code || 0),
        status: Number(code || 0) === 0 ? 'passed' : 'failed',
      });
    });

    child.on('error', async (error) => {
      await finalizeJob(jobId, {
        exitCode: 1,
        meta: {
          ...job.meta,
          spawnError: String(error?.message || error || 'unknown_spawn_error'),
        },
        status: 'failed',
      });
    });

    return {
      ok: true,
      started: true,
      job,
    };
  }

  return {
    listStatus,
    normalizeMode,
    startJob,
  };
}

module.exports = {
  createRetestService,
  normalizeMode,
};
