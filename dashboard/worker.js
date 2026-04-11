const { createAiWorker } = require('./workers/aiWorker');
const { createFixWorker } = require('./workers/fixWorker');
const { createRetestWorker } = require('./workers/retestWorker');

function getRoleFromArgv() {
  const roleArg = process.argv.find((entry) => entry.startsWith('--role='));
  if (!roleArg) return 'all';
  return String(roleArg.split('=')[1] || 'all').trim().toLowerCase() || 'all';
}

function startWorkerRole(role) {
  const workers = [];

  if (role === 'all' || role === 'ai') {
    workers.push({ name: 'ai', worker: createAiWorker() });
  }

  if (role === 'all' || role === 'fix') {
    workers.push({ name: 'fix', worker: createFixWorker() });
  }

  if (role === 'all' || role === 'retest') {
    workers.push({ name: 'retest', worker: createRetestWorker() });
  }

  workers.forEach(({ name, worker }) => {
    worker.on('completed', (job) => {
      console.log(`[worker:${name}][completed]`, JSON.stringify({ id: job?.id || '', name: job?.name || '' }));
    });

    worker.on('failed', (job, error) => {
      console.error(`[worker:${name}][failed]`, JSON.stringify({
        error: String(error?.message || error || ''),
        id: job?.id || '',
        name: job?.name || '',
      }));
    });
  });

  const close = async () => {
    await Promise.all(workers.map(({ worker }) => worker.close()));
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  console.log('[worker] started', JSON.stringify({
    nodeEnv: process.env.NODE_ENV || 'development',
    role,
    total: workers.length,
  }));
}

if (require.main === module) {
  startWorkerRole(getRoleFromArgv());
}

module.exports = {
  getRoleFromArgv,
  startWorkerRole,
};
